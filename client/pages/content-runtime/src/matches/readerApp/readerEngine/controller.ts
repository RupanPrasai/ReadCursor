import { AutoScroll } from './AutoScroll';
import { Highlighter } from './Highlighter';
import { ReaderStateMachine } from './state';
import type { WordGeometry } from './Highlighter';
import type { ReaderState } from './state';

function clampInt(raw: number, min: number, max: number) {
  const num = Number.isFinite(raw) ? Math.trunc(raw) : min;
  return Math.max(min, Math.min(max, num));
}

const MIN_WPM = 50;
const MAX_WPM = 450;

export type ReaderAnchorSnapshot = {
  rcid: string | null;
  offsetInBlock: number; // 0 = first word of block
  absoluteIndex: number; // fallback
  state: ReturnType<ReaderStateMachine['getState']>;
};

export type ReaderUIStatus = {
  state: ReaderState;
  hasWords: boolean;
  wpm: number;
  anchorIndex: number;
  wordCount: number;
  rcid: string | null;

  canPlay: boolean;
  canPause: boolean;
  canStop: boolean;
  canPrevBlock: boolean;
  canNextBlock: boolean;
};

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

  private lastHighlightedIndex = 0;

  private autoScroll: AutoScroll;
  private highlighter: Highlighter;

  private listeners = new Set<() => void>();
  private revision = 0;
  private rcidPosByRcid = new Map<string, number>();

  private notify = () => {
    this.revision++;
    for (const fn of this.listeners) fn();
  };

  public subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  public getSnapshot = () => this.revision;

  public getStatus = (): ReaderUIStatus => {
    const state = this.state.getState();
    const hasWords = this.words.length > 0;
    const rcid = this.getCurrentRcid();
    const anchorIndex = this.getAnchorWordIndex();
    const wordCount = this.words.length;

    const canPlay = state === 'READY' || state === 'PAUSED';
    const canPause = state === 'PLAYING';
    const canStop = state === 'PLAYING' || state === 'PAUSED';

    let canPrevBlock = false;
    let canNextBlock = false;

    if (hasWords && rcid) {
      const range = this.rangeByRcid.get(rcid);
      const pos = this.rcidPosByRcid.get(rcid);

      // matches your prevBlock() semantics:
      // - if not at first word of block, "Prev" restarts block
      // - else it goes to previous block if one exists
      if (range && anchorIndex > range.start) canPrevBlock = true;
      else if (typeof pos === 'number' && pos > 0) canPrevBlock = true;

      if (typeof pos === 'number' && pos < this.orderedRcids.length - 1) canNextBlock = true;
    }

    return {
      state,
      hasWords,
      wpm: this.wpm,
      anchorIndex,
      wordCount,
      rcid,

      canPlay,
      canPause,
      canStop,
      canPrevBlock,
      canNextBlock,
    };
  };

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

  private clampWordIndex(i: number) {
    if (!this.words.length) return 0;
    return Math.max(0, Math.min(this.words.length - 1, i));
  }

  private rebuildRangesAndOrder(words: WordGeometry[]) {
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

    this.orderedRcids = Array.from(this.rangeByRcid.entries())
      .sort((a, b) => a[1].start - b[1].start)
      .map(([rcid]) => rcid);

    this.rcidPosByRcid.clear();
    for (let i = 0; i < this.orderedRcids.length; i++) {
      this.rcidPosByRcid.set(this.orderedRcids[i], i);
    }
  }

  load(words: WordGeometry[]) {
    this.words = words;
    this.index = 0;
    this.lastHighlightedIndex = 0;
    this.resumePending = false;
    this.clearTimer();

    this.rebuildRangesAndOrder(words);
    this.state.setReady();

    this.notify();
  }

  /**
   * Snapshot current "place" in a way that's stable across geometry rebuilds:
   * - primary: (rcid, offset within that block)
   * - fallback: absolute index
   */
  public snapshotAnchor(): ReaderAnchorSnapshot {
    const absoluteIndex = this.getAnchorWordIndex();
    const rcid = this.getCurrentRcid();

    let offsetInBlock = 0;
    if (rcid) {
      const range = this.rangeByRcid.get(rcid);
      if (range) offsetInBlock = absoluteIndex - range.start;
    }

    return {
      rcid,
      offsetInBlock: Math.max(0, offsetInBlock),
      absoluteIndex,
      state: this.state.getState(),
    };
  }

  private resolveIndexFromSnapshot(snapshot: ReaderAnchorSnapshot) {
    if (!this.words.length) return 0;

    const rcid = snapshot.rcid;
    if (rcid) {
      const range = this.rangeByRcid.get(rcid);
      if (range) {
        const len = Math.max(1, range.end - range.start);
        const off = Math.max(0, Math.min(len - 1, snapshot.offsetInBlock));
        return this.clampWordIndex(range.start + off);
      }
    }

    // fallback: absolute index
    return this.clampWordIndex(snapshot.absoluteIndex);
  }

  /**
   * Replaces geometry while preserving:
   * - reading position (rcid + offset)
   * - PLAYING vs PAUSED vs READY semantics
   *
   * This is what App will call after recomputing word geometry on resize/zoom.
   */
  public reloadGeometry(words: WordGeometry[]) {
    if (!words?.length) return;

    const snap = this.snapshotAnchor();

    const wasPlaying = this.state.isPlaying();
    const wasPaused = this.state.isPaused();

    // If we were ENDED/IDLE, allow play again after reload.
    this.state.setReady();

    // stop timing + clear visuals while swapping the backing array
    this.clearTimer();
    this.resumePending = false;
    this.highlighter.clearAll();

    // swap & rebuild indices
    this.words = words;
    this.rebuildRangesAndOrder(words);

    const highlightIndex = this.resolveIndexFromSnapshot(snap);

    if (wasPlaying) {
      // For PLAYING, we want scheduleNext() to highlight highlightIndex and then
      // advance index to next word (maintains invariants).
      this.index = highlightIndex;
      this.scheduleNext();
      return;
    }

    if (wasPaused) {
      // For PAUSED, we want:
      // - highlight the same word immediately
      // - keep index pointing to NEXT word (so resumePending works correctly)
      this.seekPaused(highlightIndex);
      return;
    }

    // READY (or other non-playing state): just show the highlight at the same place.
    this.seek(highlightIndex);

    this.notify();
  }

  play() {
    this.resumePending = this.state.isPaused();
    this.state.play();
    this.notify();
  }

  pause() {
    this.state.pause();
    this.notify();
  }

  stop() {
    this.resumePending = false;
    this.state.stop();
    this.state.setReady();
    this.notify();
  }

  private getAnchorWordIndex() {
    // While playing/paused, index points to "next word"; the highlighted word is tracked separately.
    if (!this.words.length) return 0;

    const i = this.state.isPlaying() || this.state.isPaused() ? this.lastHighlightedIndex : this.index;
    return this.clampWordIndex(i);
  }

  private getCurrentRcid(): string | null {
    if (!this.words.length) return null;
    const i = this.getAnchorWordIndex();
    const rcid = this.words[i]?.rcid;
    return rcid == null ? null : String(rcid);
  }

  private jumpToIndex(targetIndex: number) {
    if (!this.words.length) return;
    const i = this.clampWordIndex(targetIndex);

    const wasPlaying = this.state.isPlaying();

    this.clearTimer();
    this.resumePending = false;
    this.highlighter.clearAll();
    this.index = i;

    if (wasPlaying)
      this.scheduleNext(); // highlights + continues
    else this.seek(i); // highlights only, no auto-advance

    this.notify();
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

  /**
   * Start from selection context.
   * Rule:
   *  - If a real selection exists (selStartChar finite) and word start/end offsets are element-global:
   *      ALWAYS use char-offset mapping (layout-proof under zoom/resize reflow).
   *  - Only fallback to rect-proximity when selection mapping is not available.
   */

  startFromHere(lastCtx: {
    rcid?: string | number | null;
    clientX: number;
    clientY: number;
    selStartChar?: number | null;
    selClientX?: number | null;
    selClientY?: number | null;
    pageX?: number | null;
    pageY?: number | null;
  }) {
    let rcid = lastCtx.rcid == null ? null : String(lastCtx.rcid);
    if (!rcid) return;

    // If caller passed a nested rcid, normalize to closest highlightable block rcid.
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
    const hasSel = typeof selStartChar === 'number' && Number.isFinite(selStartChar);

    // Sanity: offsets within this block should be non-decreasing if they're element-global.
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

    let bestCharI: number | null = null;

    if (hasSel && charOffsetsLookGlobal) {
      // Prefer containment by [start, end)
      for (let i = start; i < end; i++) {
        const w: any = this.words[i];
        if (typeof w.start === 'number' && typeof w.end === 'number') {
          if (w.start <= (selStartChar as number) && (selStartChar as number) < w.end) {
            bestCharI = i;
            break;
          }
        }
      }

      // Fallback: closest start
      if (bestCharI == null) {
        let bestDelta = Infinity;
        for (let i = start; i < end; i++) {
          const w: any = this.words[i];
          if (typeof w.start === 'number') {
            const d = Math.abs(w.start - (selStartChar as number));
            if (d < bestDelta) {
              bestDelta = d;
              bestCharI = i;
            }
          }
        }
      }
    }

    // ✅ HARD RULE: if we have a usable selection mapping, NEVER choose by rect proximity.
    if (bestCharI != null) {
      const wasPlaying = this.state.isPlaying();

      this.clearTimer();
      this.resumePending = false;
      this.highlighter.clearAll();
      this.index = bestCharI;

      if (wasPlaying) this.scheduleNext();
      else this.state.play();

      this.notify(); // <-- only notify when we actually changed state/index
      return;
    }

    // Rect fallback only when selection mapping isn't available.
    const xClient = typeof lastCtx.selClientX === 'number' ? lastCtx.selClientX : lastCtx.clientX;
    const yClient = typeof lastCtx.selClientY === 'number' ? lastCtx.selClientY : lastCtx.clientY;

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

    for (let i = start; i < end; i++) {
      const raw = (this.words[i] as any).rect;
      if (!raw) continue;

      const r = rectBounds(raw);
      const d = dist2ToRect(xClient, yClient, r);

      if (d < bestD) {
        bestD = d;
        bestRectI = i;
        if (bestD === 0) break;
      }
    }

    const wasPlaying = this.state.isPlaying();

    this.clearTimer();
    this.resumePending = false;
    this.highlighter.clearAll();
    this.index = bestRectI;

    if (wasPlaying) this.scheduleNext();
    else this.state.play();

    this.notify(); // <-- notify once after mutation
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
    this.lastHighlightedIndex = 0;
    this.highlighter.clearAll();
  }

  private advanceWord() {
    this.scheduleNext();
  }

  private scheduleTickOnly() {
    if (!this.state.isPlaying()) return;

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

    if (!this.state.isPlaying()) return;

    if (this.index >= this.words.length) {
      this.stop();
      return;
    }

    const currentWord = this.words[this.index];

    this.highlighter.highlightBlock(currentWord);
    this.highlighter.highlightWord(currentWord);

    this.lastHighlightedIndex = this.index;

    this.index++;

    this.timer = window.setTimeout(() => {
      this.state.nextWord();
    }, this.msPerWord);
  }

  /**
   * Seek + highlight only (no timer). Leaves index pointing *at* that word.
   */
  seek(index: number) {
    if (index < 0 || index >= this.words.length) return;

    this.index = index;
    this.lastHighlightedIndex = index;

    const currentWord = this.words[this.index];
    this.highlighter.highlightBlock(currentWord);
    this.highlighter.highlightWord(currentWord);

    this.notify();
  }

  /**
   * PAUSED invariant: keep highlight at i, but index should point to NEXT word.
   * This preserves your "resumePending" semantics (resume continues forward).
   */
  private seekPaused(highlightIndex: number) {
    const i = this.clampWordIndex(highlightIndex);
    this.seek(i);

    // index should point to the next word to play
    const next = i + 1;
    this.index = next <= this.words.length ? next : this.words.length;

    this.notify();
  }

  setWPM(raw: number) {
    const wpm = clampInt(raw, MIN_WPM, MAX_WPM);
    if (wpm === this.wpm) return;

    this.wpm = wpm;

    if (this.state.isPlaying()) {
      this.clearTimer();
      this.scheduleTickOnly();
    }

    this.notify();
  }
}
