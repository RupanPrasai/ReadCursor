import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';

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

export function annotateWords() {
  const articleContainer = document.getElementById('content') ?? document.body;
  let wordIdCounter = 1;

  const walker = document.createTreeWalker(articleContainer, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      if (!node.textContent || node.textContent.trim() === '') {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentNode as Element;
      if (parent?.matches('script, style') || parent?.hasAttribute('data-word-id')) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!(parent instanceof Element)) {
        return NodeFilter.FILTER_ACCEPT;
      }
      if (parent.closest('script, style')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode: Text | null;

  const regex = /(\w+['-]?\w*|\W+)/g;

  while ((currentNode = walker.nextNode() as Text | null)) {
    const textContent = currentNode.nodeValue;
    if (!textContent) continue;

    const parts = textContent.match(regex);

    if (!parts?.length) continue;

    const fragment = document.createDocumentFragment();

    for (const part of parts) {
      if (/\w/.test(part)) {
        const span = document.createElement('span');
        span.setAttribute('data-word-id', String(wordIdCounter++));
        span.textContent = part;
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    }

    const parentNode = currentNode.parentNode;
    if (parentNode) {
      parentNode.replaceChild(fragment, currentNode);
      walker.currentNode = parentNode;
    }
  }

  return wordIdCounter;
}
