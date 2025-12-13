import { AutoScroll } from './AutoScroll';
import { Highlighter } from './Highlighter';
import { ReaderStateMachine } from './state';
import type { WordGeometry } from './Highlighter';

export class ReaderController {
  private words: WordGeometry[] = [];
  private index = 0;
  private timer: number | null = null;

  private state = new ReaderStateMachine();

  private msPerWord = 200;

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

  load(words: WordGeometry[], wpm: number) {
    this.words = words;
    this.index = 0;
    this.msPerWord = 60000 / wpm;
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

  setWPM(wpm: number) {
    this.msPerWord = 60000 / wpm;
  }
}
