import { Highlighter } from './Highlighter';
import type { WordGeometry } from './Highlighter';

export class ReaderController {
  private words: WordGeometry[] = [];
  private index = 0;
  private timer: number | null = null;
  private isPlaying = false;
  private msPerWord = 200;
  private highlighter = new Highlighter();

  constructor() { }

  load(words: WordGeometry[], wpm: number) {
    this.words = words;
    this.index = 0;
    this.msPerWord = 60000 / wpm;
  }

  play() {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.scheduleNext();
  }

  pause() {
    this.isPlaying = false;

    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  resume() {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.scheduleNext();
  }

  stop() {
    this.isPlaying = false;
    this.index = 0;

    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext() {
    if (!this.isPlaying) {
      return;
    }

    if (this.index >= this.words.length) {
      this.stop();
      return;
    }

    const currentWord = this.words[this.index];
    console.log('CURRENT WORD FROM SCHEDULE NEXT', currentWord);
    this.highlighter.highlightWord(currentWord);

    this.index++;

    this.timer = window.setTimeout(() => {
      this.scheduleNext();
    }, this.msPerWord);
  }

  seek(index: number) {
    if (index < 0 || index >= this.words.length) {
      return;
    }

    this.index = index;
    this.highlighter.highlightWord(this.words[this.index]);
  }

  setWPM(wpm: number) {
    this.msPerWord = 60000 / wpm;
  }
}
