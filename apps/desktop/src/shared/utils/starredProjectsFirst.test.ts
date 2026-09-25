import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { starredProjectsFirst } from './starredProjectsFirst';

const at = (value: string): IsoDateTime => value as IsoDateTime;

describe('starredProjectsFirst', () => {
  it('puts starred projects first, the most recently used one on top, and keeps the rest in order', () => {
    const projects = [
      { name: 'payments-api', lastAccessedAt: at('2026-09-20T10:00:00.000Z') },
      {
        name: 'ledger-core',
        starredAt: at('2026-09-01T10:00:00.000Z'),
        lastAccessedAt: at('2026-09-10T10:00:00.000Z'),
      },
      { name: 'notify-relay' },
      {
        name: 'runbooks',
        starredAt: at('2026-09-02T10:00:00.000Z'),
        lastAccessedAt: at('2026-09-24T10:00:00.000Z'),
      },
    ];

    expect(starredProjectsFirst({ projects }).map((project) => project.name)).toEqual([
      'runbooks',
      'ledger-core',
      'payments-api',
      'notify-relay',
    ]);
  });

  it('returns the same order when nothing is starred', () => {
    const projects: ReadonlyArray<{ name: string; starredAt?: IsoDateTime }> = [
      { name: 'ledger-core' },
      { name: 'notify-relay' },
    ];
    expect(starredProjectsFirst({ projects }).map((project) => project.name)).toEqual([
      'ledger-core',
      'notify-relay',
    ]);
  });
});
