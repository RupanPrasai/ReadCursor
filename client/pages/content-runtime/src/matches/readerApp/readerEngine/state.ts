export type ReaderState = 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED' | 'ENDED';

export class ReaderStateMachine {
  private state: ReaderState = 'IDLE';

  private onPlay: (() => void) | null = null;
  private onPause: (() => void) | null = null;
  private onStop: (() => void) | null = null;
  private onNextWord: (() => void) | null = null;

  bindHandlers(handlers: { onPlay?: () => void; onPause?: () => void; onStop?: () => void; onNextWord?: () => void }) {
    this.onPlay = handlers.onPlay ?? null;
    this.onPause = handlers.onPause ?? null;
    this.onStop = handlers.onStop ?? null;
    this.onNextWord = handlers.onNextWord ?? null;
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

  setReady() {
    if (this.state === 'IDLE' || this.state === 'ENDED') {
      this.state = 'READY';
    }
  }

  play() {
    if (this.state === 'READY' || this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.onPlay?.();
    }
  }

  pause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.onPause?.();
    }
  }

  stop() {
    this.state = 'ENDED';
    this.onStop?.();
  }

  nextWord() {
    if (this.state === 'PLAYING') {
      this.onNextWord?.();
    }
  }
}
