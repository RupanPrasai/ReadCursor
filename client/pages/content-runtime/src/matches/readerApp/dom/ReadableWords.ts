const __basisByRcid = new Map<number, 'client' | 'page' | 'unknown'>();
const __debugOnceByRcid = new Set<number>();

function guessBasis(top: number) {
  const pad = 50;
  const clientOk = top >= -pad && top <= window.innerHeight + pad;
  const pageOk = top - window.scrollY >= -pad && top - window.scrollY <= window.innerHeight + pad;

  if (pageOk && !clientOk) return 'page';
  if (clientOk && !pageOk) return 'client';
  if (clientOk && pageOk) return 'ambiguous';
  return 'unknown';
}

export function* walkTextNodes(root: Element): Generator<Text> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue && /\S/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let current;
  while ((current = walker.nextNode())) {
    yield current as Text;
  }
}

export function getWordBoundaries(text: string): Array<[number, number]> {
  const boundaries: Array<[number, number]> = [];
  const regex = /\b[\w’']+(\b|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    boundaries.push([match.index, match.index + match[0].length]);
  }
  return boundaries;
}

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

export function extractWordsFromNode(element: Element) {
  const rcid = Number(element.getAttribute('data-rcid'));
  const words: any[] = [];

  const blockRectRaw = element.getBoundingClientRect();
  const blockRect = toAbsoluteRect(blockRectRaw);
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

      const rect = range.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;

      const absolute = toAbsoluteRect(rect);

      /* DEBUG LOG
       *
       *
       *
       */

      if (!__debugOnceByRcid.has(rcid)) {
        __debugOnceByRcid.add(rcid);
        console.log('[rect-basis]', {
          rcid,
          word: text.slice(start, end),
          rectTop: rect.top, // client-space
          absTop: absolute.top, // page-space
          scrollY: window.scrollY,
          diff: absolute.top - rect.top, // should be ~scrollY
        });
      }

      const basis = guessBasis(absolute.top);
      if (!__basisByRcid.has(rcid)) {
        __basisByRcid.set(rcid, basis === 'ambiguous' ? 'unknown' : (basis as any));
        console.log('[rect-store]', {
          rcid,
          word: text.slice(start, end),
          absTop: absolute.top,
          absLeft: absolute.left,
          scrollY: window.scrollY,
          innerH: window.innerHeight,
          topMinusScrollY: absolute.top - window.scrollY,
          basis,
        });
      } else {
        const prev = __basisByRcid.get(rcid)!;
        const cur = basis === 'ambiguous' ? prev : (basis as any);
        if (prev !== 'unknown' && cur !== 'unknown' && prev !== cur) {
          console.warn('[rect-mixed-basis]', { rcid, prev, cur, word: text.slice(start, end) });
        }
      }

      /* DEBUG LOG END
       *
       *
       */

      const localRect = {
        left: absolute.left - blockRect.left,
        top: absolute.top - blockRect.top,
        width: absolute.width,
        height: absolute.height,
      };

      words.push({
        rcid,
        text: text.slice(start, end),
        blockRect,
        blockLocalRect,
        rect: absolute,
        localRect,
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
