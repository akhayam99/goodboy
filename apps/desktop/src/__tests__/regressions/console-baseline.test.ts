// @vitest-environment node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toEntryId, type ConsoleBaseline } from '../../test/consoleKey';

const DESKTOP_ROOT = join(import.meta.dirname, '..', '..', '..');
const BASELINE_CEILING = 18;
const BASELINE_SHA256 = '1490d788ff3d4760a8401efb6058c0be435fc525bf43f0a3a29137b0581cc272';

const digest = (): string =>
  createHash('sha256').update(baseline.entries.map(toEntryId).sort().join('\n')).digest('hex');

const baseline: ConsoleBaseline = JSON.parse(
  readFileSync(join(DESKTOP_ROOT, 'src', 'test', 'console-baseline.json'), 'utf8'),
);

describe('console baseline', () => {
  it('never grows: shrink it, then lower BASELINE_CEILING to the new count', () => {
    expect(baseline.entries.length).toBe(BASELINE_CEILING);
  });

  it('is the reviewed set: swapping an entry fails until BASELINE_SHA256 is updated', () => {
    expect(digest()).toBe(BASELINE_SHA256);
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
