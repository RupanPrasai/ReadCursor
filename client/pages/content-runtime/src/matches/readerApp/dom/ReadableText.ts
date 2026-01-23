import { Readability } from '@mozilla/readability';

interface ReadableArticle {
  content: HTMLElement;
  title: string;
  textContent: string;
  length: number;
}

function isReadableTag(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  return (
    tag === 'p' ||
    tag === 'span' ||
    tag === 'li' ||
    tag === 'dd' ||
    tag === 'dt' ||
    tag === 'h1' ||
    tag === 'h2' ||
    tag === 'h3' ||
    tag === 'h4' ||
    tag === 'h5' ||
    tag === 'h6'
  );
}

function isReadableFontSize(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const rectHeight = rect?.height ?? 0;
  const rectWidth = rect?.width ?? 0;

  if (rectHeight <= 2) return false;
  if (rectWidth <= 2) return false;

  return true;
}

function findTitleNode(title: string): HTMLElement | null {
  if (!title) return null;

  const normalized = title.trim().toLowerCase();
  const candidates = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

  for (let i = 0; i < candidates.length; i++) {
    const element = candidates[i];
    const text = element.textContent?.trim().toLowerCase();
    if (text === normalized) {
      return element as HTMLElement;
    }
  }
  return null;
}

/**
 * - Labelling DOM Nodes
 */
function labelDomNodes(): void {
  let max = 0;

  // Find current max rcid (numeric only)
  const scan = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  while (scan.nextNode()) {
    const el = scan.currentNode as Element;
    const rcid = el.getAttribute('data-rcid');
    if (!rcid) continue;
    if (/^\d+$/.test(rcid)) {
      max = Math.max(max, Number(rcid));
    }
  }

  let rcCounter = max + 1;

  // Label any unlabeled elements
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
    if (el.hasAttribute('data-rcid')) continue;
    el.setAttribute('data-rcid', String(rcCounter++));
  }
}

function readDOM(): Set<number> {
  labelDomNodes();

  const clone = document.cloneNode(true) as Document;
  const options = {
    serializer: (el: any) => el,
  };

  const reader = new Readability(clone, options);
  const article = reader.parse() as ReadableArticle | null;

  if (!article || !article.content) {
    return new Set<number>();
  }

  let titleNode: HTMLElement | null = null;
  if (article.title) {
    titleNode = findTitleNode(article.title);
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
    if (node.nodeType !== node.ELEMENT_NODE) continue;

    const element = node as Element;
    if (!isReadableTag(element)) continue;

    const rcid = element.getAttribute('data-rcid');
    if (rcid) readableIds.add(Number(rcid));
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

const HIGHLIGHT_CSS_ID = '__READCURSOR_HIGHLIGHTABLE_CSS__';

function injectHighlightableCSSOnce() {
  if (document.getElementById(HIGHLIGHT_CSS_ID)) return;

  const style = document.createElement('style');
  style.id = HIGHLIGHT_CSS_ID;

  // IMPORTANT:
  // - Keep the existing geometry-driven highlight variables (--hl-*, --block-*)
  // - Make colors configurable via CSS variables so prefs can update live
  style.textContent = `
    :root {
      --rc-word-hl: rgba(255, 0, 0, 0.35);
      --rc-block-hl: rgba(0, 150, 255, 0.15);
    }

    .rc-highlightable {
      position: relative !important;

      background-image:
        linear-gradient(transparent, transparent),
        linear-gradient(var(--rc-word-hl), var(--rc-word-hl)),
        linear-gradient(var(--rc-block-hl), var(--rc-block-hl));

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

  injectHighlightableCSSOnce();
  return result;
}
