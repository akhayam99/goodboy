const PICKER = '[role="combobox"][aria-label="Link to a session"]';

export const isInboxLinkRequest = (value: string | null): boolean => value === 'open';

export const driveInboxLink = (): (() => void) => {
  const advance = (): void => {
    const picker = document.querySelector<HTMLElement>(PICKER);
    if (picker === null || (picker instanceof HTMLButtonElement && picker.disabled)) {
      return;
    }
    observer.disconnect();
    if (picker.getAttribute('aria-expanded') !== 'true') {
      picker.click();
    }
  };
  const observer = new MutationObserver(advance);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  advance();
  return () => observer.disconnect();
};
