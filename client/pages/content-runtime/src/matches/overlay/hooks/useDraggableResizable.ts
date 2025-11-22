import { useRef } from 'react';

export function useDraggableResizable(options: {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const startX = event.clientX;
    const startY = event.clientY;

    const rect = overlay.getBoundingClientRect();
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;

    const onMouseMove = (event: MouseEvent) => {
      overlay.style.left = `${event.clientX - offsetX}px`;
      overlay.style.top = `${event.clientY - offsetY}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Resize Overlay Container

  const startResize =
    (direction: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w') => (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();

      const overlay = overlayRef.current;
      if (!overlay) return;

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = overlay.offsetWidth;
      const startHeight = overlay.offsetHeight;
      const startLeft = overlay.offsetLeft;
      const startTop = overlay.offsetTop;

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

        overlay.style.width = `${newWidth}px`;
        overlay.style.height = `${newHeight}px`;
        overlay.style.left = `${newLeft}px`;
        overlay.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

  return { overlayRef, startDrag, startResize };
}
