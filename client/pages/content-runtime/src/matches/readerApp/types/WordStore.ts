import type { Word } from '../dom/DomScanner';

export let WORDS: Word[] = [];

export function setWords(words: Word[]) {
  WORDS = words;
}

export function getWords() {
  return WORDS;
}
