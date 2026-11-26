import { formatBytes } from '../../shared/utils/formatBytes';
import type { BrowserConsoleEntry } from './types';

type Params = {
  readonly rows: ReadonlyArray<BrowserConsoleEntry>;
  readonly all: ReadonlyArray<BrowserConsoleEntry>;
};

const countTextOf = ({ rows, all }: Params): string => {
  const noun = all.length === 1 ? 'request' : 'requests';
  return rows.length === all.length
    ? `${all.length} ${noun}`
    : `${rows.length} of ${all.length} ${noun}`;
};

const loadedTextOf = ({ all }: Pick<Params, 'all'>): string | null => {
  const page = all.find((row) => row.network?.type === 'doc' && row.network.start === 0);
  const duration = page?.network?.duration ?? null;
  return duration === null || duration <= 0 ? null : `Loaded in ${Math.round(duration)} ms`;
};

export const networkSummaryOf = ({ rows, all }: Params): ReadonlyArray<string> => {
  const sizes = rows.flatMap((row) => {
    const size = row.network?.size ?? null;
    return size === null ? [] : [size];
  });
  const loaded = loadedTextOf({ all });
  return [
    countTextOf({ rows, all }),
    ...(sizes.length === 0
      ? []
      : [formatBytes({ bytes: sizes.reduce((sum, size) => sum + size, 0) })]),
    ...(loaded === null ? [] : [loaded]),
  ];
};
