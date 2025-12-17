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
    selClientX?: number | null;
    selClientY?: number | null;
  }) {
    const rcid = lastCtx.rcid == null ? null : String(lastCtx.rcid);
    if (!rcid) return;

    const range = this.rangeByRcid.get(rcid);
    if (!range) return;

    const selStartChar = lastCtx.selStartChar;

    let bestCharI: number | null = null;

    if (typeof selStartChar === 'number' && Number.isFinite(selStartChar)) {
      for (let i = range.start; i < range.end; i++) {
        const w: any = this.words[i];
        if (typeof w.start === 'number' && typeof w.end === 'number') {
          if (w.start <= selStartChar && selStartChar < w.end) {
            bestCharI = i;
            break;
          }
        }
      }

      if (bestCharI == null) {
        let bestDelta = Infinity;
        for (let i = range.start; i < range.end; i++) {
          const w: any = this.words[i];
          if (typeof w.start === 'number') {
            const d = Math.abs(w.start - selStartChar);
            if (d < bestDelta) {
              bestDelta = d;
              bestCharI = i;
            }
          }
        }
      }
    }

    const x = typeof lastCtx.selClientX === 'number' ? lastCtx.selClientX : lastCtx.clientX;
    const y = typeof lastCtx.selClientY === 'number' ? lastCtx.selClientY : lastCtx.clientY;

    const normalizeRectToClient = (rect: any) => {
      const left = rect.left ?? rect.x ?? 0;
      const top = rect.top ?? rect.y ?? 0;
      const width = rect.width ?? 0;
      const height = rect.height ?? 0;
      const right = rect.right ?? left + width;
      const bottom = rect.bottom ?? top + height;

      const looksPage = top > window.innerHeight * 2 || left > window.innerWidth * 2;

      if (!looksPage) return { left, top, right, bottom };

      return {
        left: left - window.scrollX,
        right: right - window.scrollX,
        top: top - window.scrollY,
        bottom: bottom - window.scrollY,
      };
    };

    const dist2ToRect = (x: number, y: number, rect: { left: number; top: number; right: number; bottom: number }) => {
      const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
      const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
      return dx * dx + dy * dy;
    };

    let bestRectI = range.start;
    let bestD = Infinity;

    for (let i = range.start; i < range.end; i++) {
      const raw = (this.words[i] as any).rect;
      if (!raw) continue;

      const rect = normalizeRectToClient(raw);
      const d = dist2ToRect(x, y, rect);

      if (d < bestD) {
        bestD = d;
        bestRectI = i;
        if (bestD === 0) break;
      }
    }

    console.log('[startFromHere]', { rcid, selStartChar, bestCharI, bestRectI, bestD, x, y });

    const sample = (this.words[bestRectI] as any)?.rect;
    console.log('[rectBasis]', {
      scrollY: window.scrollY,
      innerH: window.innerHeight,
      sampleTop: sample?.top,
      sampleLeft: sample?.left,
    });

    const RECT_TRUST_D2 = 200 * 200;

    let bestI: number;

    if (Number.isFinite(bestD) && bestD <= RECT_TRUST_D2) {
      bestI = bestRectI;
    } else if (bestCharI != null) {
      bestI = bestCharI;
    } else {
      bestI = bestRectI;
    }

    const wasPlaying = this.state.isPlaying();
    this.clearTimer();
    this.resumePending = false;
    this.highlighter.clearAll();
    this.index = bestI;

    if (wasPlaying) this.scheduleNext();
    else this.state.play();
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
