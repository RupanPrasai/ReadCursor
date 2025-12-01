import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';

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

interface ReadResult {
  textContent: string | null;
  content: string | null;
}

interface CursorPointer {
  node: Text;
  startOffset: number;
  endOffset: number;
  token: string;
}

function readDOM(): string | null {
  const documentClone = document.cloneNode(true) as Document;
  const reader = new Readability(documentClone);
  const article = reader.parse() as Article | null;
  const content = article?.content ?? null;

  if (!article?.content) {
    return null;
  }
  return content;
}

function sanitizeDOM(dirty: string): string {
  const cleanDOM = DOMPurify.sanitize(dirty);
  return cleanDOM;
}

function tokenize(text: string): string[] {
  const regex = /\b\p{L}+(?:['’]\p{L}+)?\b/gu;
  return text.match(regex) ?? [];
}

export function createReaderReferences(): string[] | null {
  const dirtyHTML = readDOM();
  let cleanDOM;
  if (dirtyHTML) {
    cleanDOM = sanitizeDOM(dirtyHTML);
  } else {
    cleanDOM = null;
  }

  if (cleanDOM) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = cleanDOM;

    const cleanWalker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
    const segments: string[] = [];
    let textNode = cleanWalker.nextNode() as Text | null;

    while (textNode) {
      const text = textNode.textContent?.trim();
      if (text) {
        segments.push(...tokenize(text));
      }
      textNode = cleanWalker.nextNode() as Text | null;
    }

    return segments;
  } else {
    return null;
  }
}

export function findPageTextNodes(): Text[] {
  const domWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let textNode: Text | null;

  while ((textNode = domWalker.nextNode() as Text | null)) {
    const text = textNode.textContent?.trim();
    if (text) {
      nodes.push(textNode);
    }
  }
  return nodes;
}

export function mapReferencesToPageAnchors(): any {
  const anchors: CursorPointer[] = [];
  const segments: string[] | null = createReaderReferences();
  const pageNodes: Text[] = findPageTextNodes();
  if (!segments) return null;
  if (!pageNodes) return null;

  for (const node of pageNodes) {
    const content = node.textContent ?? '';

    for (const segment of segments) {
      const regex = new RegExp(`\\b${segment}\\b`, 'gu');
      let match;
      while ((match = regex.exec(content))) {
        anchors.push({
          node,
          startOffset: match.index,
          endOffset: match.index + segment.length,
          token: segment,
        });
      }
    }
  }

  return anchors;
}
