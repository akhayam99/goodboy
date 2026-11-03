import type { HiddenPort, HiddenPortSource } from '@goodboy/core/monitoring';
import { isValidPort } from './isValidPort';
import { portRecordsOf } from './portRecordsOf';

type Params = {
  readonly raw: string | null;
};

type ValueParams = {
  readonly value: unknown;
};

const sourceOf = ({ value }: ValueParams): HiddenPortSource | null =>
  value === 'goodboy' || value === 'workspace' || value === 'listening' ? value : null;

export const parseHiddenPorts = ({ raw }: Params): ReadonlyArray<HiddenPort> => {
  const hidden = new Map<string, HiddenPort>();
  for (const record of portRecordsOf({ raw })) {
    if (typeof record.port !== 'number' || !isValidPort({ port: record.port })) {
      continue;
    }
    const source = sourceOf({ value: record.source });
    if (source === null) {
      continue;
    }
    hidden.set(`${source}:${record.port}`, { port: record.port, source });
  }
  return [...hidden.values()].sort((a, b) => a.port - b.port || a.source.localeCompare(b.source));
};
