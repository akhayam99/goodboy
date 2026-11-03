import type { PinnedPort } from '@goodboy/core/monitoring';
import { isValidPort } from './isValidPort';
import { normalizeDescription } from './pinDescription';
import { portRecordsOf } from './portRecordsOf';

type Params = {
  readonly raw: string | null;
};

export const parsePinnedPorts = ({ raw }: Params): ReadonlyArray<PinnedPort> => {
  const pins = new Map<number, PinnedPort>();
  for (const record of portRecordsOf({ raw })) {
    if (typeof record.port !== 'number' || !isValidPort({ port: record.port })) {
      continue;
    }
    if (pins.has(record.port)) {
      continue;
    }
    const description = typeof record.description === 'string' ? record.description : '';
    pins.set(record.port, {
      port: record.port,
      description: normalizeDescription({ text: description }),
    });
  }
  return [...pins.values()].sort((a, b) => a.port - b.port);
};
