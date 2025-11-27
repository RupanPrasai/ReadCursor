import { getLastSelection } from './SelectionTracker';
import { WORDS } from '../types/WordStore';

export function mapSelectionToIndex(): number {
  const selection = getLastSelection();
  if (!selection?.anchorNode) {
    return -1;
  }

  const node = selection.anchorNode;
  const offset = selection.anchorOffset;

  const exact = WORDS.find(word => word.node === node && offset >= word.startOffset && offset <= word.endOffset);
  if (exact) {
    return exact.index;
  }

  const text = selection.toString().trim();
  const candidates = WORDS.map((word, index) => [word.text === text, index] as const).filter(([m]) => m);

  if (candidates.length) {
    const [, position] = candidates.reduce((best, curr) =>
      Math.abs(WORDS[curr[1]].startOffset - offset) < Math.abs(WORDS[best[1]].startOffset - offset) ? curr : best,
    );
    return WORDS[position].index;
  }

  return -1;
}
