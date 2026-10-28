import { demoRuns } from './demoRunRegistry';

const POLL_MS = 150;
const REMOVE = '[data-demo-anchor="storage-remove"]';

export const openStorageRemoveConfirm = (): void => {
  let untrack = (): void => undefined;
  const timer = window.setInterval(() => {
    const button = document.querySelector<HTMLElement>(REMOVE);
    if (button === null) {
      return;
    }
    window.clearInterval(timer);
    untrack();
    button.click();
  }, POLL_MS);
  untrack = demoRuns.track({ cancel: () => window.clearInterval(timer) });
};
