import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toEntryId, type ConsoleBaseline } from '../../test/consoleKey';

const DESKTOP_ROOT = join(import.meta.dirname, '..', '..', '..');
const BASELINE_CEILING = 112;

const baseline: ConsoleBaseline = JSON.parse(
  readFileSync(join(DESKTOP_ROOT, 'src', 'test', 'console-baseline.json'), 'utf8'),
);

describe('console baseline', () => {
  it('never grows: shrink it, then lower BASELINE_CEILING to the new count', () => {
    expect(baseline.entries.length).toBe(BASELINE_CEILING);
  });

  it('has no duplicate entry', () => {
    const ids = baseline.entries.map(toEntryId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points only at test files that still exist', () => {
    const missing = baseline.entries
      .map((entry) => entry.file)
      .filter((file) => !existsSync(join(DESKTOP_ROOT, file)));
    expect([...new Set(missing)]).toEqual([]);
  });

  it('holds only entries with a message', () => {
    expect(baseline.entries.filter((entry) => entry.message.trim() === '')).toEqual([]);
  });
});
