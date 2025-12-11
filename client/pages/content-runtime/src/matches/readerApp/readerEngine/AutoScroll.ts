export class AutoScroll {
  private margin = 200;

  checkScroll(blockElement: HTMLElement) {
    const rect = blockElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (rect.top < this.margin || rect.bottom > viewportHeight - this.margin) {
      this.initiateScroll(blockElement);
    }
  }

  initiateScroll(blockElement: HTMLElement) {
    blockElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
}
