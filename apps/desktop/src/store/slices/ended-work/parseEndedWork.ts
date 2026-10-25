import { foregroundLabelOf } from '../../../features/terminal/foregroundLabelOf';
import type { EndedScript, EndedWork } from './state';

type ParseParams = {
  readonly raw: string;
};

type ValueParams = {
  readonly value: unknown;
};

const objectOrNull = ({ value }: ValueParams): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

const scriptOf = ({ value }: ValueParams): EndedScript | null => {
  const entry = objectOrNull({ value });
  if (entry === null) {
    return null;
  }
  const { scriptId, sessionId, name, cwd } = entry;
  if (
    typeof scriptId !== 'string' ||
    typeof sessionId !== 'string' ||
    typeof name !== 'string' ||
    typeof cwd !== 'string'
  ) {
    return null;
  }
  return { scriptId, sessionId, name, cwd };
};

const terminalEntryOf = ({ value }: ValueParams): readonly [string, string] | null => {
  const entry = objectOrNull({ value });
  if (entry === null) {
    return null;
  }
  const { id, command } = entry;
  if (typeof id !== 'string' || typeof command !== 'string') {
    return null;
  }
  const label = foregroundLabelOf({ command });
  return label === '' ? null : [id, label];
};

export const parseEndedWork = ({ raw }: ParseParams): EndedWork | null => {
  const parsed = objectOrNull({ value: JSON.parse(raw) });
  if (parsed === null || typeof parsed['at'] !== 'number') {
    return null;
  }
  const terminals: ReadonlyArray<unknown> = Array.isArray(parsed['terminals'])
    ? parsed['terminals']
    : [];
  const scripts: ReadonlyArray<unknown> = Array.isArray(parsed['scripts']) ? parsed['scripts'] : [];
  return {
    at: parsed['at'],
    terminals: Object.fromEntries(
      terminals.flatMap((value) => {
        const entry = terminalEntryOf({ value });
        return entry === null ? [] : [entry];
      }),
    ),
    scripts: scripts.flatMap((value) => {
      const script = scriptOf({ value });
      return script === null ? [] : [script];
    }),
  };
};
