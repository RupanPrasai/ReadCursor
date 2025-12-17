import { AutoScroll } from './AutoScroll';
import { Highlighter } from './Highlighter';
import { ReaderStateMachine } from './state';
import type { WordGeometry } from './Highlighter';

function clampInt(raw: number, min: number, max: number) {
  const num = Number.isFinite(raw) ? Math.trunc(raw) : min;
  return Math.max(min, Math.min(max, num));
}

const MIN_WPM = 50;
const MAX_WPM = 450;

export class ReaderController {
  private words: WordGeometry[] = [];
  private index = 0;
  private timer: number | null = null;

  private state = new ReaderStateMachine();

  private wpm = 300;

  private resumePending = false;

  private rangeByRcid = new Map<string, { start: number; end: number }>();

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

  private clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  load(words: WordGeometry[]) {
    this.words = words;
    this.index = 0;
    this.resumePending = false;
    this.clearTimer();

    this.rangeByRcid.clear();
    for (let i = 0; i < words.length; i++) {
      const rcid = String(words[i].rcid);
      const existing = this.rangeByRcid.get(rcid);
      if (!existing) {
        this.rangeByRcid.set(rcid, { start: i, end: i + 1 });
      } else {
        existing.end = i + 1;
      }
    }

    this.state.setReady();
  }

  play() {
    this.resumePending = this.state.isPaused();
    this.state.play();
  }

  pause() {
    this.state.pause();
  }

  stop() {
    this.resumePending = false;
    this.state.stop();
    this.state.setReady();
  }

  startFromHere(lastCtx: {
    rcid?: string | number | null;
    clientX: number;
    clientY: number;
    selStartChar?: number | null;
    selTokens?: string[];
  }) {
    const rcid = lastCtx.rcid == null ? null : String(lastCtx.rcid);
    if (!rcid) return;

    const range = this.rangeByRcid.get(rcid);
    if (!range) return;

    let bestI: number | null = null;

    const selStartChar = lastCtx.selStartChar;
    if (typeof selStartChar === 'number' && Number.isFinite(selStartChar)) {
      for (let i = range.start; i < range.end; i++) {
        const w = this.words[i] as any;
        if (w.start <= selStartChar && selStartChar < w.end) {
          bestI = i;
          break;
        }
      }

      if (bestI == null) {
        let bestDelta = Infinity;
        for (let i = range.start; i < range.end; i++) {
          const w = this.words[i] as any;
          const d = Math.abs(w.start - selStartChar);
          if (d < bestDelta) {
            bestDelta = d;
            bestI = i;
          }
        }
      }
    }

    if (bestI == null) {
      const { clientX, clientY } = lastCtx;

      const dist2ToRect = (x: number, y: number, rect: any) => {
        const left = rect.left,
          top = rect.top;
        const right = rect.right ?? rect.left + rect.width;
        const bottom = rect.bottom ?? rect.top + rect.height;
        const dx = x < left ? left - x : x > right ? x - right : 0;
        const dy = y < top ? top - y : y > bottom ? y - bottom : 0;
        return dx * dx + dy * dy;
      };

      let bestD = Infinity;
      let fallbackI = range.start;

      for (let i = range.start; i < range.end; i++) {
        const rect = (this.words[i] as any).rect;
        if (!rect) continue;
        const d = dist2ToRect(clientX, clientY, rect);
        if (d < bestD) {
          bestD = d;
          fallbackI = i;
          if (bestD === 0) break;
        }
      }

      bestI = fallbackI;
    }

    const wasPlaying = this.state.isPlaying();

    this.clearTimer();
    this.resumePending = false;
    this.highlighter.clearAll();
    this.index = bestI!;

    if (wasPlaying) {
      this.scheduleNext();
    } else {
      this.state.play();
    }
  }

  private startPlayback() {
    this.clearTimer();

    if (this.resumePending) {
      this.resumePending = false;
      this.scheduleTickOnly();
      return;
    }

    this.scheduleNext();
  }

  private pausePlayback() {
    this.clearTimer();
  }

  private stopPlayback() {
    this.pausePlayback();
    this.index = 0;
    this.highlighter.clearAll();
  }

  private advanceWord() {
    this.scheduleNext();
  }

  private scheduleTickOnly() {
    if (!this.state.isPlaying()) {
      return;
    }

    if (this.index >= this.words.length) {
      this.stop();
      return;
    }

    this.timer = window.setTimeout(() => {
      this.state.nextWord();
    }, this.msPerWord);
  }

  private scheduleNext() {
    this.clearTimer();

    if (!this.state.isPlaying()) {
      return;
    }

    if (this.index >= this.words.length) {
      this.stop();
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
    const wpm = clampInt(raw, MIN_WPM, MAX_WPM);
    if (wpm === this.wpm) {
      return;
    }

    this.wpm = wpm;

    if (this.state.isPlaying()) {
      this.clearTimer();
      this.scheduleTickOnly();
    }
  }
}
