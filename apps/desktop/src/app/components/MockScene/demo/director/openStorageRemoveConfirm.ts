const POLL_MS = 150;
const GIVE_UP_MS = 8000;
const REMOVE = '[data-demo-anchor="storage-remove"]';

export const openStorageRemoveConfirm = (): void => {
  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    const button = document.querySelector<HTMLElement>(REMOVE);
    if (button !== null) {
      window.clearInterval(timer);
      button.click();
      return;
    }
    if (Date.now() - startedAt > GIVE_UP_MS) {
      window.clearInterval(timer);
    }
  }, POLL_MS);
};
