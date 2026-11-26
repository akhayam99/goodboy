import type { BrowserConsoleEntry } from '../../types';

type Params = {
  readonly entry: BrowserConsoleEntry;
};

export const requestKeyOf = ({ entry }: Params): string => entry.network?.id ?? `seq:${entry.seq}`;
