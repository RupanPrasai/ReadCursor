export interface Word {
  index: number;
  text: string;
  node: Text;
  startOffset: number;
  endOffset: number;
  getRect: () => DOMRect | null; // lazy bounding box
}

export interface ScanResult {
  words: Word[];
}

function isVisible(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return false;

  const style = window.getComputedStyle(parent);
  if (style.visibility === 'hidden' || style.display === 'none') return false;

  // Ignore script/style tags
  const tag = parent.tagName?.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'noscript') return false;

  return true;
}

export function scanDOM(): ScanResult {
  const words: Word[] = [];
  let index = 0;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent;
      if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
      if (!isVisible(node as Text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current: Text | null = walker.nextNode() as Text | null;

  while (current) {
    const content = current.textContent || '';

    const regex = /\b\w+\b/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const startOffset = match.index;
      const endOffset = match.index + match[0].length;

      const word: Word = {
        index: index++,
        text: match[0],
        node: current,
        startOffset,
        endOffset,
        getRect: () => {
          const textNode = current as Text;
          const range = document.createRange();
          range.setStart(textNode, startOffset);
          range.setEnd(textNode, endOffset);
          return range.getBoundingClientRect();
        },
      };

      words.push(word);
    }

    current = walker.nextNode() as Text | null;
  }

  return { words };
}

