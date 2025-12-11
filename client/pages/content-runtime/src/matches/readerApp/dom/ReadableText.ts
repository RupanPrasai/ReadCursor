import { Readability } from '@mozilla/readability';

interface ReadableArticle {
  content: HTMLElement;
  title: string;
  textContent: string;
  length: number;
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function isReadableTag(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (
    tag !== 'p' &&
    tag !== 'span' &&
    tag !== 'li' &&
    tag !== 'dd' &&
    tag !== 'dt' &&
    tag !== 'h1' &&
    tag !== 'h2' &&
    tag !== 'h3' &&
    tag !== 'h4' &&
    tag !== 'h5' &&
    tag !== 'h6'
  ) {
    return false;
  }
  return true;
}

function isReadableFontSize(element: Element): boolean {
  const rect = element.getBoundingClientRect();

  if (!rect) {
    return false;
  }

  const rectHeight = rect.height;
  const rectWidth = rect.width;

  if (rectHeight <= 2) {
    return false;
  }

  if (rectWidth <= 2) {
    return false;
  }

  return true;
}

function findTitleNode(title: string): HTMLElement | null {
  if (!title) {
    return null;
  }

  title = title.trim().toLowerCase();

  const candidates = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

  for (let i = 0; i < candidates.length; i++) {
    const element = candidates[i];
    const text = element.textContent?.trim().toLowerCase();
    if (text === title) {
      return element as HTMLElement;
    }
  }
  return null;
}

function labelDomNodes(): void {
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

function readDOM(): Set<number> {
  labelDomNodes();
  const clone = document.cloneNode(true) as Document;
  const options = {
    serializer: el => el,
  };

  const reader = new Readability(clone, options);

  const article = reader.parse() as ReadableArticle | null;

  if (!article || !article.content) {
    const readableIds = new Set<number>();
    return readableIds;
  }

  let articleTitle;
  let titleNode: HTMLElement | null = null;

  if (article.title) {
    articleTitle = article.title;
    titleNode = findTitleNode(articleTitle);
  }

  const root = article.content as HTMLElement;
  const readableIds = new Set<number>();

  if (titleNode) {
    const titleId = titleNode.getAttribute('data-rcid');
    if (titleId !== null) {
      readableIds.add(Number(titleId));
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === node.ELEMENT_NODE) {
      const element = node as Element;
      if (!isReadableTag(element)) {
        continue;
      }
      const rcid = (node as Element).getAttribute('data-rcid');
      if (rcid) {
        readableIds.add(Number(rcid));
      }
    }
  }

  return readableIds;
}

function buildNodeMap(): Map<number, Element> {
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

function injectHighlightableCSS() {
  const style = document.createElement('style');

  style.textContent = `
    .rc-highlightable {
      position: relative !important;
      
      background-image:
        linear-gradient(transparent, transparent),
        linear-gradient(rgba(255, 0, 0, 0.35), rgba(255, 0, 0, 0.35)),
        linear-gradient(rgba(0, 150, 255, 0.15), rgba(0, 150, 255, 0.15));

      background-repeat: no-repeat;

      --hl-left: 0px;
      --hl-top: 0px;
      --hl-width: 0px;
      --hl-height: 0px;

      --block-left: 0px;
      --block-top: 0px;
      --block-width: 0px;
      --block-height: 0px;

      background-position:
        0 0,
        var(--hl-left) var(--hl-top),
        var(--block-left) var(--block-top);
      
      background-size:
        100% 100%,
        var(--hl-width) var(--hl-height),
        var(--block-width) var(--block-height);
    }
  `;
  document.head.appendChild(style);
}

export function getReadableNodes(): Element[] {
  const readableIds = readDOM();
  const originalMap = buildNodeMap();

  const result: Element[] = [];

  for (const id of readableIds) {
    const element = originalMap.get(id);
    if (element && isReadableFontSize(element)) {
      element.classList.add('rc-highlightable');
      result.push(element);
    }
  }
  injectHighlightableCSS();
  return result;
}
