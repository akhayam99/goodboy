const POLL_MS = 150;
const GIVE_UP_MS = 4000;

const pushButtonOf = (): HTMLButtonElement | undefined =>
  [...document.querySelectorAll('button')].find(
    (button) => button.textContent?.trim().startsWith('Force push') === true,
  );

export const openStoryPushConfirm = (): void => {
  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    const button = pushButtonOf();
    if (button !== undefined) {
      window.clearInterval(timer);
      button.click();
      return;
    }
    if (Date.now() - startedAt > GIVE_UP_MS) {
      window.clearInterval(timer);
    }
  }, POLL_MS);
};
