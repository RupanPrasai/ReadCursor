export interface Word {
  index: number;
  text: string;
  node: Text;
  startOffset: number;
  endOffset: number;
  getRect: () => DOMRect | null;
}

export interface ScanResult {
  words: Word[];
}

function isVisible();
