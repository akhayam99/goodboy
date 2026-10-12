import type { PinnedPort } from '@goodboy/core';
import { isValidPort } from './isValidPort';
import { normalizeDescription } from './pinDescription';

type Params = {
  readonly raw: string | null;
};

type ValueParams = {
  readonly value: unknown;
};

const recordOf = ({ value }: ValueParams): Readonly<Record<string, unknown>> | null =>
  typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : null;

const parseList = ({ raw }: Params): ReadonlyArray<unknown> => {
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const parsePinnedPorts = ({ raw }: Params): ReadonlyArray<PinnedPort> => {
  const pins = new Map<number, PinnedPort>();
  for (const item of parseList({ raw })) {
    const record = recordOf({ value: item });
    if (record === null || typeof record.port !== 'number' || !isValidPort({ port: record.port })) {
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
