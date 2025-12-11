export type ReaderState = 'IDLE' | 'READY' | 'PLAYING' | 'SCROLLING' | 'PAUSED' | 'ENDED';

export class ReaderStateMachine {
  private state: ReaderState = 'IDLE';

  private onPlay: (() => void) | null = null;
  private onPause: (() => void) | null = null;
  private onStop: (() => void) | null = null;
  private onNextWord: (() => void) | null = null;
  private onScrollStart: (() => void) | null = null;
  private onScrollEnd: (() => void) | null = null;

  bindHandlers(handlers: {
    onPlay?: () => void;
    onPause?: () => void;
    onStop?: () => void;
    onNextWord?: () => void;
    onScrollStart?: () => void;
    onScrollEnd?: () => void;
  }) {
    this.onPlay = handlers.onPlay ?? null;
    this.onPause = handlers.onPause ?? null;
    this.onStop = handlers.onStop ?? null;
    this.onNextWord = handlers.onNextWord ?? null;
    this.onScrollStart = handlers.onScrollStart ?? null;
    this.onScrollEnd = handlers.onScrollEnd ?? null;
  }

  getState(): ReaderState {
    return this.state;
  }

  isPlaying() {
    return this.state === 'PLAYING';
  }

  isPaused() {
    return this.state === 'PAUSED';
  }

  isScrolling() {
    return this.state === 'SCROLLING';
  }

  setReady() {
    if (this.state === 'IDLE') {
      this.state = 'READY';
    }
  }

  play() {
    if (this.state === 'READY' || this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.onPlay?.();
    }
  }
}
