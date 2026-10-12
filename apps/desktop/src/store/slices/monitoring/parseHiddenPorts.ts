import type { HiddenPort, HiddenPortSource } from '@goodboy/core';
import { isValidPort } from './isValidPort';

type Params = {
  readonly raw: string | null;
};

type ValueParams = {
  readonly value: unknown;
};

const recordOf = ({ value }: ValueParams): Readonly<Record<string, unknown>> | null =>
  typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : null;

const sourceOf = ({ value }: ValueParams): HiddenPortSource | null =>
  value === 'goodboy' || value === 'workspace' || value === 'listening' ? value : null;

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

export const parseHiddenPorts = ({ raw }: Params): ReadonlyArray<HiddenPort> => {
  const hidden = new Map<string, HiddenPort>();
  for (const item of parseList({ raw })) {
    const record = recordOf({ value: item });
    if (record === null || typeof record.port !== 'number' || !isValidPort({ port: record.port })) {
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
