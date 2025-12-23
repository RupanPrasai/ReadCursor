export function* walkTextNodes(root: Element): Generator<Text> {
  // IMPORTANT: include *all* text nodes (including whitespace-only),
  // because selStartChar is computed via Range.toString().length over the whole element.
  // If we skip whitespace-only nodes here, global offsets will drift.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let current: Node | null;
  while ((current = walker.nextNode())) {
    yield current as Text;
  }
}

export function getWordBoundaries(text: string): Array<[number, number]> {
  const boundaries: Array<[number, number]> = [];
  const regex = /\b[\w’']+(\b|$)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    boundaries.push([match.index, match.index + match[0].length]);
  }
  return boundaries;
}

/**
 * Kept for compatibility (some code may still import it).
 * Note: extraction now uses client-space rects + local offsets.
 */
export function toAbsoluteRect(rect: DOMRect): DOMRect {
  return {
    x: rect.x + window.scrollX,
    y: rect.y + window.scrollY,
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    bottom: rect.bottom + window.scrollY,
    right: rect.right + window.scrollX,
    width: rect.width,
    height: rect.height,
  } as DOMRect;
}

function rectToPlain(r: DOMRect | DOMRectReadOnly) {
  const left = r.left;
  const top = r.top;
  const width = r.width;
  const height = r.height;
  return {
    left,
    top,
    width,
    height,
    x: (r as any).x ?? left,
    y: (r as any).y ?? top,
    right: (r as any).right ?? left + width,
    bottom: (r as any).bottom ?? top + height,
  };
}

export function extractWordsFromNode(element: Element) {
  const rcid = Number(element.getAttribute('data-rcid'));
  const words: any[] = [];

  // CLIENT-space rects
  const blockRectRaw = element.getBoundingClientRect();
  const blockRect = rectToPlain(blockRectRaw);

  const blockLocalRect = {
    left: 0,
    top: 0,
    width: blockRect.width,
    height: blockRect.height,
  };

  // Global char offset across *all* descendant text nodes of this element.
  // This is what makes selStartChar mapping stable under zoom/resize/reflow.
  let globalTextOffset = 0;

  for (const textNode of walkTextNodes(element)) {
    const text = textNode.nodeValue ?? '';

    // Compute word boundaries within THIS text node (node-local)
    const boundaries = getWordBoundaries(text);

    for (const [startLocal, endLocal] of boundaries) {
      const range = document.createRange();
      range.setStart(textNode, startLocal);
      range.setEnd(textNode, endLocal);

      const wordRectRaw = range.getBoundingClientRect();
      if (wordRectRaw.width < 1 || wordRectRaw.height < 1) continue;

      const rect = rectToPlain(wordRectRaw);

      const localRect = {
        left: rect.left - blockRect.left,
        top: rect.top - blockRect.top,
        width: rect.width,
        height: rect.height,
      };

      // Convert node-local offsets -> element-global offsets
      const start = globalTextOffset + startLocal;
      const end = globalTextOffset + endLocal;

      words.push({
        rcid,
        text: text.slice(startLocal, endLocal),

        blockRect,
        rect,

        blockLocalRect,
        localRect,

        // NOW: element-global offsets (not per text node)
        start,
        end,

        node: element,
      });
    }

    // Always advance by full node length (including whitespace),
    // so offsets match Range.toString() length semantics.
    globalTextOffset += text.length;
  }

  return words;
}

export function extractWordGeometryFromReadableNodes(readableNodes: Element[]) {
  const results: any[] = [];

  for (const element of readableNodes) {
    results.push(...extractWordsFromNode(element));
  }

  return results;
}
