import type { ReaderStateMachine } from './state';

export class AutoScroll {
  private margin = 200;
  private isScrolling = false;
  private state: ReaderStateMachine;

  constructor(stateMachine: ReaderStateMachine) {
    this.state = stateMachine;
  }

  private animateScrollTo(targetY: number, duration = 400) {
    if (this.isScrolling) {
      return;
    }

    this.isScrolling = true;

    const startY = window.scrollY;
    const delta = targetY - startY;
    const startTime = performance.now();

    const ease = (time: number) => (time < 0.5 ? 2 * time * time : -1 + (4 - 2 * time) * time);

    const frame = (now: number) => {
      const time = Math.min((now - startTime) / duration, 1);
      const progress = ease(time);

      window.scrollTo(0, startY + delta * progress);

      if (time < 1) {
        requestAnimationFrame(frame);
      } else {
        this.isScrolling = false;
        this.state.endScroll();
      }
    };
    requestAnimationFrame(frame);
  }

  checkScroll(blockElement: HTMLElement) {
    const rect = blockElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (rect.top < this.margin || rect.bottom > viewportHeight - this.margin) {
      this.initiateScroll(blockElement);
    }
  }

  initiateScroll(blockElement: HTMLElement) {
    if (this.isScrolling) {
      return;
    }

    this.state.beginScroll();

    const rect = blockElement.getBoundingClientRect();
    const targetY = window.scrollY + rect.top - window.innerHeight * 0.3;

    this.animateScrollTo(targetY, 400);
  }
}
