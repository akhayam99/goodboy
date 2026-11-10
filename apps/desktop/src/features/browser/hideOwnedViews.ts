import { browserHost } from './browserHost';
import { VIEW_OWNERS } from './viewOwners';

const HIDE_WAIT_MS = 400;

export const hideOwnedViews = async (): Promise<void> => {
  const hides = Array.from(VIEW_OWNERS.keys()).map((tabId) => browserHost.hide({ tabId }));
  await Promise.race([
    Promise.allSettled(hides),
    new Promise((resolve) => setTimeout(resolve, HIDE_WAIT_MS)),
  ]);
};
