export function lockScrollToAnchor(options: {
  scrollEl: HTMLDivElement | null;
  anchorEl: HTMLDivElement | null;
  rafRef: { current: number | null };
  timerRef: { current: ReturnType<typeof setTimeout> | null };
}): void {
  const { scrollEl, anchorEl, rafRef, timerRef } = options;
  if (!scrollEl || !anchorEl) return;
  if (timerRef.current) clearTimeout(timerRef.current);
  if (rafRef.current) cancelAnimationFrame(rafRef.current);
  const scrollRect = scrollEl.getBoundingClientRect();
  const anchorRect = anchorEl.getBoundingClientRect();
  const visualOffset = anchorRect.top - scrollRect.top;
  let frames = 0;
  const enforce = () => {
    if (scrollEl && anchorEl) {
      const newScrollRect = scrollEl.getBoundingClientRect();
      const newAnchorRect = anchorEl.getBoundingClientRect();
      const currentOffset = newAnchorRect.top - newScrollRect.top;
      const diff = currentOffset - visualOffset;
      if (Math.abs(diff) > 1) {
        scrollEl.scrollTop += diff;
      }
    }
    if (++frames < 25) {
      rafRef.current = requestAnimationFrame(enforce);
    }
  };
  rafRef.current = requestAnimationFrame(enforce);
  timerRef.current = setTimeout(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    timerRef.current = null;
  }, 800);
}
