import type { BrowserTab } from '../../store/slices/browser/types';

type Params = {
  readonly pins: ReadonlyArray<BrowserTab>;
  readonly tabs: ReadonlyArray<BrowserTab>;
  readonly currentId: string | null;
  readonly step: 1 | -1;
};

export const stepTab = ({ pins, tabs, currentId, step }: Params): BrowserTab | null => {
  const order = [...tabs, ...pins];
  if (order.length === 0) {
    return null;
  }
  const index = order.findIndex((tab) => tab.id === currentId);
  if (index < 0) {
    return order[step === 1 ? 0 : order.length - 1] ?? null;
  }
  return order[(index + step + order.length) % order.length] ?? null;
};
