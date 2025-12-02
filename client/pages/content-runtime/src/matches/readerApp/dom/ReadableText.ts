import { Readability } from '@mozilla/readability';

interface Article {
  title: string | null;
  content: string;
  textContent: string;
  length: number;
  excerpt: string | null;
  byline: string | null;
  dir: string | null;
  siteName: string | null;
  lang: string | null;
  publishedTime: string | null;
}

interface ReadableArticle {
  content: HTMLElement;
  title: string;
  textContent: string;
  length: number;
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

export function labelDomNodes(): void {
  let rcCounter = 1;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode;

    const id = rcCounter++;

    if (isElement(node)) {
      node.setAttribute('data-rcid', String(id));
    }
  }
}

export function readDOM(): { root: HTMLElement | null; readableIds: Set<number> } {
  const clone = document.cloneNode(true) as Document;
  const options = {
    serializer: el => el,
  };

  const reader = new Readability(clone, options);

  const article = reader.parse() as ReadableArticle | null;

  if (!article || !article.content) {
    return {
      root: null,
      readableIds: new Set(),
    };
  }

  const root = article.content as HTMLElement;
  const readableIds = new Set<number>();

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === node.ELEMENT_NODE) {
      const rcid = (node as Element).getAttribute('data-rcid');
      if (rcid) {
        readableIds.add(Number(rcid));
      }
    }
  }

  return {
    root,
    readableIds,
  };
}

export function buildNodeMap(): Map<number, Element> {
  const map = new Map<number, Element>();

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);

  while (walker.nextNode()) {
    const element = walker.currentNode as Element;
    const rcid = element.getAttribute('data-rcid');
    if (rcid) {
      map.set(Number(rcid), element);
    }
  }

  return map;
}

export function getReadableNodes(): Element[] {
  const { readableIds } = readDOM();
  const originalMap = buildNodeMap();

  const result: Element[] = [];

  for (const id of readableIds) {
    const element = originalMap.get(id);
    if (element) {
      result.push(element);
    }
  }
  return result;
}
