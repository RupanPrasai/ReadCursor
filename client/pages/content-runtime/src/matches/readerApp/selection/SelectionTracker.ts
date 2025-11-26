export let lastSelection: Selection | null = null;

document.addEventListener('selectionchange', () => {
  lastSelection = window.getSelection();
});

export const getLastSelection = () => lastSelection;
