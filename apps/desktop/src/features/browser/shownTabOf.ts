import type { BrowserTab } from '../../store/slices/browser/types';
import type { ShownTab } from './types';

type Params = {
  readonly tabs: ReadonlyArray<BrowserTab>;
  readonly pins: ReadonlyArray<BrowserTab>;
  readonly activeId: string | null;
  readonly pinId: string | null;
};

export const shownTabOf = ({ tabs, pins, activeId, pinId }: Params): ShownTab | null => {
  const pin = pinId === null ? undefined : pins.find((candidate) => candidate.id === pinId);
  if (pin !== undefined) {
    return { tab: pin, isPin: true };
  }
  const tab = activeId === null ? undefined : tabs.find((candidate) => candidate.id === activeId);
  return tab === undefined ? null : { tab, isPin: false };
};
