export interface WordGeometry {
  rcid: number;
  text: string;
  rect: {
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
  }

  highlightWord(word: WordGeometry) {
    const { left, top, width, height } = word.rect;

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.element.style.opacity = '1';
  }

  hideHighlighter() {
    this.element.style.opacity = '0';
  }

  destroyHighlighter() {
    this.element.remove();
  }
}
