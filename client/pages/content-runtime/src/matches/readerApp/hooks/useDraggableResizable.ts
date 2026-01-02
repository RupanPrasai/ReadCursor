import { useRef } from 'react';

type ResizeDir = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export function useDraggableResizable(options: {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}) {
  const readerPanelRef = useRef<HTMLDivElement>(null);

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const readerPanel = readerPanelRef.current;
    if (!readerPanel) return;

    // Prevent text selection / native drag behaviors while dragging
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;

    const rect = readerPanel.getBoundingClientRect();
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;

    const onMouseMove = (event: MouseEvent) => {
      readerPanel.style.left = `${event.clientX - offsetX}px`;
      readerPanel.style.top = `${event.clientY - offsetY}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  // Resize ReaderPanel Container
  const startResize = (direction: ResizeDir) => (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault(); // critical: prevents text selection during resize

    const readerPanel = readerPanelRef.current;
    if (!readerPanel) return;

    const startX = event.clientX;
    const startY = event.clientY;

    const startWidth = readerPanel.offsetWidth;
    const startHeight = readerPanel.offsetHeight;
    const startLeft = readerPanel.offsetLeft;
    const startTop = readerPanel.offsetTop;

    // Anchor edges so min-size clamping doesn't translate the panel.
    const startRight = startLeft + startWidth;
    const startBottom = startTop + startHeight;

    const onMouseMove = (event: MouseEvent) => {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;

      // Horizontal
      if (direction.includes('e')) {
        // Right edge follows mouse
        const desiredWidth = startWidth + dx;
        newWidth = clamp(desiredWidth, options.minWidth, options.maxWidth);
        // Left side stays anchored at startLeft
        newLeft = startLeft;
      }

      if (direction.includes('w')) {
        // Left edge follows mouse but right edge is anchored
        const desiredWidth = startWidth - dx;
        newWidth = clamp(desiredWidth, options.minWidth, options.maxWidth);
        newLeft = startRight - newWidth; // <- key fix: recompute from anchored right edge
      }

      // Vertical
      if (direction.includes('s')) {
        // Bottom edge follows mouse
        const desiredHeight = startHeight + dy;
        newHeight = clamp(desiredHeight, options.minHeight, options.maxHeight);
        newTop = startTop;
      }

      if (direction.includes('n')) {
        // Top edge follows mouse but bottom edge is anchored
        const desiredHeight = startHeight - dy;
        newHeight = clamp(desiredHeight, options.minHeight, options.maxHeight);
        newTop = startBottom - newHeight;
      }

      readerPanel.style.width = `${newWidth}px`;
      readerPanel.style.height = `${newHeight}px`;
      readerPanel.style.left = `${newLeft}px`;
      readerPanel.style.top = `${newTop}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return { readerPanelRef, startDrag, startResize };
}
