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
  start: number;
  end: number;
  node: Node;
}

export class Highlighter {
  private element: HTMLDivElement;
  private blockElement: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');

    Object.assign(this.element.style, {
      position: 'absolute',
      background: 'rgba(255, 0, 0, 0.35)',
      borderRadius: '3px',
      pointerEvents: 'none',
      zIndex: '999999',
      transition: 'left 70ms linear, top 70ms linear, width 70ms linear, height 70ms linear, opacity 70ms linear',
      opacity: '0',
    });

    document.documentElement.appendChild(this.element);

    this.blockElement = document.createElement('div');

    Object.assign(this.blockElement.style, {
      position: 'absolute',
      background: 'rgba(0, 150, 255, 0.15)',
      borderRadius: '4px',
      pointerEvents: 'none',
      zIndex: '999990',
      opacity: '0',
      transition: 'left 70ms linear, top 70ms linear, width 70ms linear, height 70ms linear, opacity 70ms linear',
    });

    document.documentElement.appendChild(this.blockElement);
  }

  highlightWord(currentWord: WordGeometry) {
    const { left, top, width, height } = currentWord.rect;

    const padRatio = 0.05;
    const horizontalPad = width * padRatio;
    const paddedLeft = left - horizontalPad;
    const paddedWidth = width + horizontalPad * 2;

    this.element.style.left = `${paddedLeft}px`;
    this.element.style.top = `${top}px`;
    this.element.style.width = `${paddedWidth}px`;
    this.element.style.height = `${height}px`;
    this.element.style.opacity = '1';
  }

  highlightBlock(currentWord: WordGeometry) {
    const { left, top, width, height } = currentWord.blockRect;

    this.blockElement.style.left = `${left}px`;
    this.blockElement.style.top = `${top}px`;
    this.blockElement.style.width = `${width}px`;
    this.blockElement.style.height = `${height}px`;
    this.blockElement.style.opacity = '1';
  }

  hideHighlighter() {
    this.element.style.opacity = '0';
  }

  destroyHighlighter() {
    this.element.remove();
  }
}
