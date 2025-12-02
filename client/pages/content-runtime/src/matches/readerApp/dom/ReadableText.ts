import { Readability, isProbablyReaderable } from '@mozilla/readability';

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

export function isReadable(document: Document): boolean {
  const options = {
    minContentLength: 1,
  };
  return isProbablyReaderable(document, options);
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

export function readableWalker() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let textNode: Text | null;

  while ((textNode = walker.nextNode() as Text | null)) {
    const text = textNode.textContent?.trim();
    if (text) {
      nodes.push(textNode);
    }
  }
  return nodes;
}

export function readDOM(): Article | null {
  const clone = document.cloneNode(true) as Document;
  const options = {
    serializer: el => el,
  };

  const reader = new Readability(clone, options);

  const article = reader.parse() as Article | null;
  const content = article?.content ?? null;

  return article;
}
