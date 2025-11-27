let highlightCursor: HTMLDivElement | null = null;

export function createHighlightCursor() {
  if (highlightCursor) {
    return highlightCursor;
  }

  highlightCursor = document.createElement('div');
  highlightCursor.id = '__READCURSOR_HIGHLIGHT_CURSOR__';
  highlightCursor.style.position = 'absolute';
  highlightCursor.style.pointerEvents = 'none';
  highlightCursor.style.zIndex = '99999';
  highlightCursor.style.background = 'rgba(255, 255, 0, 0.35)';
  highlightCursor.style.borderRadius = '3px';

  document.body.appendChild(highlightCursor);
  return highlightCursor;
}

export function highlightRect(rect: DOMRect | null) {
  if (!rect) {
    clearHighlight();
    return;
  }

  const box = createHighlightCursor();
  box.style.left = `${rect.left + window.scrollX}px`;
  box.style.top = `${rect.top + window.scrollY}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}

export function clearHighlight() {
  if (highlightCursor) {
    highlightCursor.style.width = '0px';
  }
}
