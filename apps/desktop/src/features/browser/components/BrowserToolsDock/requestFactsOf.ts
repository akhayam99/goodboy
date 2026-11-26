import { formatBytes } from '../../../../shared/utils/formatBytes';
import { networkStatusWordOf } from '../../networkStatusWordOf';
import type { BrowserConsoleEntry } from '../../types';

type Params = {
  readonly entry: BrowserConsoleEntry;
};

type RequestFacts = {
  readonly status: string;
  readonly time: string;
  readonly size: string | null;
};

export const requestFactsOf = ({ entry }: Params): RequestFacts => {
  const duration = entry.network?.duration ?? null;
  const size = entry.network?.size ?? null;
  return {
    status: networkStatusWordOf({ status: entry.status }),
    time: duration === null ? 'open' : `${Math.round(duration)} ms`,
    size: size === null ? null : formatBytes({ bytes: size }),
  };
};
