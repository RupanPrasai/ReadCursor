import type { AutoScroll } from './AutoScroll';

export interface WordGeometry {
  rcid: number;
  text: string;
  blockRect: {
    top: number;
    left: number;
    width: number;
    height: number;
    x: number;
    y: number;
    right: number;
    bottom: number;
  };
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
    x: number;
    y: number;
    right: number;
    bottom: number;
  };
  localRect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  blockLocalRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  start: number;
  end: number;
  node: Node;
}

export class Highlighter {
  private currentBlockElement: HTMLElement | null = null;
  private autoScroll: AutoScroll;

  constructor(autoScroll: AutoScroll) {
    this.autoScroll = autoScroll;
  }

  highlightWord(word: any) {
    const blockElement = word.node as HTMLElement;

    if (this.currentBlockElement && this.currentBlockElement !== blockElement) {
      this.clearWordHighlight(this.currentBlockElement);
      this.clearBlockHighlight(this.currentBlockElement);
    }

    this.currentBlockElement = blockElement;

    const rect = word.localRect;

    blockElement.style.setProperty('--hl-left', `${rect.left}px`);
    blockElement.style.setProperty('--hl-top', `${rect.top}px`);
    blockElement.style.setProperty('--hl-width', `${rect.width}px`);
    blockElement.style.setProperty('--hl-height', `${rect.height}px`);

    this.autoScroll.checkScroll(blockElement);
  }

  highlightBlock(word: any) {
    const blockElement = word.node as HTMLElement;

    const rect = word.blockLocalRect;

    blockElement.style.setProperty('--block-left', `${rect.left}px`);
    blockElement.style.setProperty('--block-top', `${rect.top}px`);
    blockElement.style.setProperty('--block-width', `${rect.width}px`);
    blockElement.style.setProperty('--block-height', `${rect.height}px`);
  }

  clearWordHighlight(blockElement: HTMLElement) {
    blockElement.style.setProperty('--hl-width', `0px`);
    blockElement.style.setProperty('--hl-height', `0px`);
  }

  clearBlockHighlight(blockElement: HTMLElement) {
    blockElement.style.setProperty('--block-width', `0px`);
    blockElement.style.setProperty('--block-height', `0px`);
  }

  clearAll() {
    if (this.currentBlockElement) {
      this.clearWordHighlight(this.currentBlockElement);
      this.clearBlockHighlight(this.currentBlockElement);
      this.currentBlockElement = null;
    }
  }
}
