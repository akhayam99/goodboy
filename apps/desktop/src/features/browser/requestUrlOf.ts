import type { BrowserConsoleEntry } from './types';

type Params = {
  readonly entry: BrowserConsoleEntry;
  readonly pageUrl: string;
};

export const requestUrlOf = ({ entry, pageUrl }: Params): string => {
  if (!entry.text.startsWith('/')) {
    return entry.text;
  }
  try {
    return new URL(entry.text, pageUrl).href;
  } catch {
    return entry.text;
  }
};
