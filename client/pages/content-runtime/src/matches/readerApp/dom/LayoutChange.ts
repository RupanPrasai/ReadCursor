export function onLayoutChange(callback: () => void) {
  let scheduled = false;

  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
    }

    requestAnimationFrame(() => {
      scheduled = false;
      callback();
    });
  };

  const resizeObserver = new ResizeObserver(() => schedule());
  resizeObserver.observe(document.documentElement);

  const mutationObserver = new MutationObserver(() => schedule());
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  });

  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', schedule);
  }

  window.addEventListener('scroll', schedule, { passive: true });

  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', schedule);

  return () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    window.removeEventListener('scroll', schedule);
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).removeEventListener('change', schedule);
  };
}
