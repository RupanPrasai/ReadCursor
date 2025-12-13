import { AutoScroll } from './AutoScroll';
import { Highlighter } from './Highlighter';
import { ReaderStateMachine } from './state';
import type { WordGeometry } from './Highlighter';

function clampInt(raw: number, min: number, max: number) {
  const num = Number.isFinite(raw) ? Math.trunc(raw) : min;
  return Math.max(min, Math.min(max, num));
}

export class ReaderController {
  private words: WordGeometry[] = [];
  private index = 0;
  private timer: number | null = null;

  private state = new ReaderStateMachine();

  private wpm = 300;

  private get msPerWord() {
    return Math.round(60000 / this.wpm);
  }

  private autoScroll: AutoScroll;
  private highlighter: Highlighter;

  constructor() {
    this.autoScroll = new AutoScroll();
    this.highlighter = new Highlighter(this.autoScroll);

    this.state.bindHandlers({
      onPlay: () => this.startPlayback(),
      onPause: () => this.pausePlayback(),
      onStop: () => this.stopPlayback(),
      onNextWord: () => this.advanceWord(),
    });
  }

  load(words: WordGeometry[]) {
    this.words = words;
    this.index = 0;
    this.state.setReady();
  }

  play() {
    this.state.play();
  }

  pause() {
    this.state.pause();
  }

  stop() {
    this.state.stop();
    this.state.setReady();
  }

  private startPlayback() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.scheduleNext();
  }

  private pausePlayback() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private stopPlayback() {
    this.pausePlayback();
    this.index = 0;
    this.highlighter.clearAll();
  }

  private advanceWord() {
    this.scheduleNext();
  }

  private scheduleNext() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.state.isPlaying()) {
      return;
    }

    if (this.index >= this.words.length) {
      this.state.stop();
      return;
    }

    const currentWord = this.words[this.index];

    this.highlighter.highlightBlock(currentWord);
    this.highlighter.highlightWord(currentWord);

    this.index++;

    this.timer = window.setTimeout(() => {
      this.state.nextWord();
    }, this.msPerWord);
  }

  seek(index: number) {
    if (index < 0 || index >= this.words.length) {
      return;
    }

    this.index = index;

    const currentWord = this.words[this.index];
    this.highlighter.highlightBlock(currentWord);
    this.highlighter.highlightWord(currentWord);
  }

  setWPM(raw: number) {
    const wpm = clampInt(raw, 100, 800);
    if (wpm === this.wpm) {
      return;
    }

    this.wpm = wpm;

    if (this.state.isPlaying()) {
      if (this.timer !== null) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.timer = window.setTimeout(() => this.state.nextWord(), this.msPerWord);
    }
  }
}
