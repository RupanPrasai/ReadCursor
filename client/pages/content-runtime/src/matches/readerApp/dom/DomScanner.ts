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

export function createReaderReferences(html: string);
