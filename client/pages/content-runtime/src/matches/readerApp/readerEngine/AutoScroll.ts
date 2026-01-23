export class AutoScroll {
  private margin = 200;
  private isScrolling = false;
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = !!enabled;
    // Do not force-cancel an in-progress scroll; just prevent new ones.
  }

  getEnabled() {
    return this.enabled;
  }

  private animateScrollTo(targetY: number, duration = 400) {
    if (!this.enabled) return;
    if (this.isScrolling) return;

    this.isScrolling = true;

    const startY = window.scrollY;
    const delta = targetY - startY;
    const startTime = performance.now();

    const ease = (time: number) => (time < 0.5 ? 2 * time * time : -1 + (4 - 2 * time) * time);

    const frame = (now: number) => {
      // If disabled mid-animation, stop ASAP.
      if (!this.enabled) {
        this.isScrolling = false;
        return;
      }

      const time = Math.min((now - startTime) / duration, 1);
      const progress = ease(time);

      window.scrollTo(0, startY + delta * progress);

      if (time < 1) {
        requestAnimationFrame(frame);
      } else {
        this.isScrolling = false;
      }
    };

    requestAnimationFrame(frame);
  }

  checkScroll(blockElement: HTMLElement | null) {
    if (!this.enabled) return;
    if (!blockElement) return;

    const rect = blockElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (rect.top < this.margin || rect.bottom > viewportHeight - this.margin) {
      this.initiateScroll(blockElement);
    }
  }

  initiateScroll(blockElement: HTMLElement) {
    if (!this.enabled) return;
    if (this.isScrolling) return;

    const rect = blockElement.getBoundingClientRect();
    const targetY = window.scrollY + rect.top - window.innerHeight * 0.3;

    this.animateScrollTo(targetY, 400);
  }
}
