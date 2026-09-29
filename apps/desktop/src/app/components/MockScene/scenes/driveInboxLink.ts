const PICKER = '[role="combobox"][aria-label="Link to a session"]';
const SETTLE_TIMEOUT_MS = 400;

export const isInboxLinkRequest = (value: string | null): boolean => value === 'open';

const enteringAnimations = (picker: HTMLElement): Animation[] =>
  document.getAnimations().filter((animation) => {
    const effect = animation.effect;
    if (effect === null || effect.getComputedTiming().iterations === Infinity) {
      return false;
    }
    const target = 'target' in effect ? effect.target : null;
    return target instanceof Element && target.contains(picker);
  });

export const driveInboxLink = (): (() => void) => {
  let isStopped = false;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const open = (picker: HTMLElement): void => {
    if (isStopped || picker.getAttribute('aria-expanded') === 'true') {
      return;
    }
    picker.click();
  };

  const openWhenSettled = (picker: HTMLElement): void => {
    frame = requestAnimationFrame(() => {
      const settled = Promise.all(
        enteringAnimations(picker).map((animation) => animation.finished),
      );
      const expired = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, SETTLE_TIMEOUT_MS);
      });
      void Promise.race([settled, expired])
        .catch(() => undefined)
        .then(() => {
          clearTimeout(timer);
          open(picker);
        });
    });
  };

  const advance = (): void => {
    const picker = document.querySelector<HTMLElement>(PICKER);
    if (picker === null || (picker instanceof HTMLButtonElement && picker.disabled)) {
      return;
    }
    observer.disconnect();
    if (picker.getAttribute('aria-expanded') !== 'true') {
      openWhenSettled(picker);
    }
  };
  const observer = new MutationObserver(advance);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  advance();
  return () => {
    isStopped = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    observer.disconnect();
  };
};
