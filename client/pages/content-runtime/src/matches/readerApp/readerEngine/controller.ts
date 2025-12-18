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

  private orderedRcids: string[] = [];

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

    this.rebuildOrderedRcids();
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

  private getAnchorWordIndex() {
    // While playing/paused, index points to "next word"; the highlighted word is index-1.
    const i = this.state.isPlaying() || this.state.isPaused() ? this.index - 1 : this.index;
    return Math.max(0, Math.min(this.words.length - 1, i));
  }

  private rebuildOrderedRcids() {
    this.orderedRcids = Array.from(this.rangeByRcid.entries())
      .sort((a, b) => a[1].start - b[1].start)
      .map(([rcid]) => rcid);
  }

  private getCurrentRcid(): string | null {
    if (!this.words.length) return null;
    const i = this.getAnchorWordIndex();
    const rcid = this.words[i]?.rcid;
    return rcid == null ? null : String(rcid);
  }

  private jumpToIndex(targetIndex: number) {
    if (!this.words.length) return;
    const i = Math.max(0, Math.min(this.words.length - 1, targetIndex));

    const wasPlaying = this.state.isPlaying();

    this.clearTimer();
    this.resumePending = false;
    this.highlighter.clearAll();
    this.index = i;

    if (wasPlaying)
      this.scheduleNext(); // highlights + continues
    else this.seek(i); // highlights only, no auto-advance
  }

  prevBlock() {
    const rcid = this.getCurrentRcid();
    if (!rcid) return;

    const range = this.rangeByRcid.get(rcid);
    if (!range) return;

    const anchor = this.getAnchorWordIndex();

    // 1st press: restart current block if not at its first word
    if (anchor > range.start) {
      this.jumpToIndex(range.start);
      return;
    }

    // 2nd press: go to previous block
    const pos = this.orderedRcids.indexOf(rcid);
    if (pos <= 0) return;

    const prevRcid = this.orderedRcids[pos - 1];
    const prevRange = this.rangeByRcid.get(prevRcid);
    if (!prevRange) return;

    this.jumpToIndex(prevRange.start);
  }

  nextBlock() {
    const rcid = this.getCurrentRcid();
    if (!rcid) return;

    const pos = this.orderedRcids.indexOf(rcid);
    if (pos < 0 || pos >= this.orderedRcids.length - 1) return;

    const nextRcid = this.orderedRcids[pos + 1];
    const nextRange = this.rangeByRcid.get(nextRcid);
    if (!nextRange) return;

    this.jumpToIndex(nextRange.start);
  }

  startFromHere(lastCtx: {
    rcid?: string | number | null;
    clientX: number;
    clientY: number;
    selStartChar?: number | null;
    selClientX?: number | null;
    selClientY?: number | null;

    // NEW: from your contextmenu listener
    pageX?: number | null;
    pageY?: number | null;
  }) {
    let rcid = lastCtx.rcid == null ? null : String(lastCtx.rcid);
    if (!rcid) return;

    // If rcid isn't a highlightable block, try to "bubble" to nearest rc-highlightable ancestor
    // (fixes selections inside <strong data-rcid=...> when your ranges are keyed by the parent <p> rcid)
    if (!this.rangeByRcid.get(rcid)) {
      const el = document.querySelector(`[data-rcid="${CSS.escape(rcid)}"]`) as HTMLElement | null;
      const block = el?.closest?.('.rc-highlightable[data-rcid]') as HTMLElement | null;
      const blockRcid = block?.getAttribute('data-rcid');
      if (blockRcid && this.rangeByRcid.get(blockRcid)) rcid = blockRcid;
    }

    const range = this.rangeByRcid.get(rcid);
    const start = range?.start ?? 0;
    const end = range?.end ?? this.words.length;
    if (start >= end) return;

    const selStartChar = lastCtx.selStartChar;

    // ---------- decide if char-based mapping is even valid ----------
    // Your wordGeometry stores start/end per TEXT NODE (resets), but selStartChar is per ELEMENT.
    // If starts are not monotonic, char-mapping will be wrong (this is exactly the <strong> displacement).
    let charOffsetsLookGlobal = true;
    {
      let prev = -Infinity;
      for (let i = start; i < end; i++) {
        const w: any = this.words[i];
        if (typeof w.start !== 'number') continue;
        if (w.start < prev) {
          charOffsetsLookGlobal = false;
          break;
        }
        prev = w.start;
      }
    }

    // ---------------- char-based candidate (ONLY if offsets look global) ----------------
    let bestCharI: number | null = null;

    if (charOffsetsLookGlobal && typeof selStartChar === 'number' && Number.isFinite(selStartChar)) {
      // exact containment
      for (let i = start; i < end; i++) {
        const w: any = this.words[i];
        if (typeof w.start === 'number' && typeof w.end === 'number') {
          if (w.start <= selStartChar && selStartChar < w.end) {
            bestCharI = i;
            break;
          }
        }
      }

      // fallback: nearest start
      if (bestCharI == null) {
        let bestDelta = Infinity;
        for (let i = start; i < end; i++) {
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

    // ---------------- geometry candidate (uses both client & page) ----------------
    const xClient = typeof lastCtx.selClientX === 'number' ? lastCtx.selClientX : lastCtx.clientX;
    const yClient = typeof lastCtx.selClientY === 'number' ? lastCtx.selClientY : lastCtx.clientY;

    const xPage = typeof lastCtx.pageX === 'number' ? lastCtx.pageX : xClient + window.scrollX;
    const yPage = typeof lastCtx.pageY === 'number' ? lastCtx.pageY : yClient + window.scrollY;

    const rectBounds = (raw: any) => {
      const left = raw.left ?? raw.x ?? 0;
      const top = raw.top ?? raw.y ?? 0;
      const width = raw.width ?? 0;
      const height = raw.height ?? 0;
      const right = raw.right ?? left + width;
      const bottom = raw.bottom ?? top + height;
      return { left, top, right, bottom };
    };

    const dist2ToRect = (x: number, y: number, r: { left: number; top: number; right: number; bottom: number }) => {
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      return dx * dx + dy * dy;
    };

    let bestRectI = start;
    let bestD = Infinity;
    let bestBasis: 'client' | 'page' | null = null;

    for (let i = start; i < end; i++) {
      const raw = (this.words[i] as any).rect;
      if (!raw) continue;

      const r = rectBounds(raw);

      // raw rects in your wordGeometry are often PAGE-space (because you store toAbsoluteRect),
      // but we handle both defensively.
      const dClient = dist2ToRect(xClient, yClient, r);
      const dPage = dist2ToRect(xPage, yPage, r);

      const d = dClient <= dPage ? dClient : dPage;
      const basis = dClient <= dPage ? 'client' : 'page';

      if (d < bestD) {
        bestD = d;
        bestRectI = i;
        bestBasis = basis;
        if (bestD === 0) break;
      }
    }

    // ---------------- choose bestI ----------------
    const RECT_TRUST_D2 = 250 * 250;

    let bestI: number;
    if (Number.isFinite(bestD) && bestD <= RECT_TRUST_D2) bestI = bestRectI;
    else if (bestCharI != null) bestI = bestCharI;
    else bestI = bestRectI;

    // ---------------- deterministic start ----------------
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
