export function* walkTextNodes(root: Element): Generator<Text> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue && /\S/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

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
    right: r.right ?? left + width,
    bottom: r.bottom ?? top + height,
  };
}

export function extractWordsFromNode(element: Element) {
  const rcid = Number(element.getAttribute('data-rcid'));
  const words: any[] = [];

  // Use CLIENT-space rects (BoundingClientRect). This aligns with CSS positioning
  // and avoids scroll/absolute-space drift under zoom/resize/visualViewport changes.
  const blockRectRaw = element.getBoundingClientRect();
  const blockRect = rectToPlain(blockRectRaw);

  const blockLocalRect = {
    left: 0,
    top: 0,
    width: blockRect.width,
    height: blockRect.height,
  };

  for (const textNode of walkTextNodes(element)) {
    const text = textNode.nodeValue!;
    const boundaries = getWordBoundaries(text);

    for (const [start, end] of boundaries) {
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, end);

      const wordRectRaw = range.getBoundingClientRect();
      if (wordRectRaw.width < 1 || wordRectRaw.height < 1) continue;

      const rect = rectToPlain(wordRectRaw);

      // localRect is relative to the block element's client rect.
      const localRect = {
        left: rect.left - blockRect.left,
        top: rect.top - blockRect.top,
        width: rect.width,
        height: rect.height,
      };

      words.push({
        rcid,
        text: text.slice(start, end),

        // client-space rects
        blockRect,
        rect,

        // local-space rects (used by Highlighter)
        blockLocalRect,
        localRect,

        // text-node offsets (per text node)
        start,
        end,

        node: element,
      });
    }
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
