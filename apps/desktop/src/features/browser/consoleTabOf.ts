import type { BrowserConsoleEntry, BrowserConsoleKind } from './types';

type Params = {
  readonly entry: BrowserConsoleEntry;
};

export const consoleTabOf = ({ entry }: Params): BrowserConsoleKind | null => {
  if (entry.kind === 'network') {
    return 'network';
  }
  if (entry.error?.origin === 'request') {
    return null;
  }
  return 'console';
};
