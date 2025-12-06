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

export function extractWordsFromNode(element: Element) {
  const rcid = Number(element.getAttribute('data-rcid'));
  const words: any[] = [];

  for (const textNode of walkTextNodes(element)) {
    const text = textNode.nodeValue!;
    const boundaries = getWordBoundaries(text);

    for (const [start, end] of boundaries) {
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, end);

      const rect = range.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;

      words.push({
        rcid,
        text: text.slice(start, end),
        rect,
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
