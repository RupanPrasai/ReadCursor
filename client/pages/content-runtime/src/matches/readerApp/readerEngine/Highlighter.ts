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
      borderRadius: '4px',
      pointerEvents: 'none',
      zIndex: '999999',
      transition: 'transform 70ms linear, width 70ms linear, height 70ms linear',
      opacity: '0',
    });

    document.body.appendChild(this.element);
  }

  highlightWord(word: WordGeometry) {
    const rect = word.rect;

    const top = rect.top;
    const left = rect.left;

    this.element.style.transform = `translate(${left}px, ${top}px)`;
    this.element.style.width = `${rect.width}px`;
    this.element.style.height = `${rect.height}px`;
    this.element.style.opacity = '1';
  }

  hideHighlighter() {
    this.element.style.opacity = '0';
  }

  destroyHighlighter() {
    this.element.remove();
  }
}
