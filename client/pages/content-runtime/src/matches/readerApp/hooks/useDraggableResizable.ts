import { useRef } from 'react';

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

  // Resize ReaderPanel Container

  const startResize =
    (direction: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w') => (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();

      const readerPanel = readerPanelRef.current;
      if (!readerPanel) return;

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = readerPanel.offsetWidth;
      const startHeight = readerPanel.offsetHeight;
      const startLeft = readerPanel.offsetLeft;
      const startTop = readerPanel.offsetTop;

      const onMouseMove = (event: MouseEvent) => {
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;

        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        // Horizontal Resize
        if (direction.includes('e')) newWidth = startWidth + dx;

        if (direction.includes('w')) {
          newWidth = startWidth - dx;
          newLeft = startLeft + dx;
        }

        // Vertical Resize
        if (direction.includes('s')) newHeight = startHeight + dy;

        if (direction.includes('n')) {
          newHeight = startHeight - dy;
          newTop = startTop + dy;
        }

        // Clamp
        newWidth = Math.min(Math.max(newWidth, options.minWidth), options.maxWidth);
        newHeight = Math.min(Math.max(newHeight, options.minHeight), options.maxHeight);

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
