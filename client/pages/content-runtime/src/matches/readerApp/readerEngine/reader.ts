import { Highlighter } from './Highlighter';
import type { WordGeometry } from './Highlighter';

const highlighter = new Highlighter();

export function playWords(words: WordGeometry[], wpm: number = 100) {
  let index = 0;
  const ms = 60000 / wpm;

  function next() {
    if (index >= words.length) {
      highlighter.hideHighlighter();
      return;
    }

    highlighter.highlightWord(words[index]);
    index++;

    setTimeout(next, ms);
  }

  next();
}
