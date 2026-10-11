// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { starredProjectsFirst } from './starredProjectsFirst';

const at = (value: string): IsoDateTime => value as IsoDateTime;

const PROJECTS = [
  { name: 'payments-api', lastAccessedAt: at('2026-09-20T10:00:00.000Z') },
  {
    name: 'ledger-core',
    starredAt: at('2026-09-01T10:00:00.000Z'),
    lastAccessedAt: at('2026-09-10T10:00:00.000Z'),
  },
  { name: 'notify-relay', lastAccessedAt: at('2026-09-25T10:00:00.000Z') },
  {
    name: 'harborline',
    starredAt: at('2026-09-02T10:00:00.000Z'),
    lastAccessedAt: at('2026-09-24T10:00:00.000Z'),
  },
  { name: 'cascadia' },
];

const names = ({ inside }: { readonly inside: 'name' | 'recency' }): ReadonlyArray<string> =>
  starredProjectsFirst({ projects: PROJECTS, inside }).map((project) => project.name);

describe('starredProjectsFirst', () => {
  it('orders both groups by recency, starred first', () => {
    expect(names({ inside: 'recency' })).toEqual([
      'harborline',
      'ledger-core',
      'notify-relay',
      'payments-api',
      'cascadia',
    ]);
  });

  it('orders both groups by name, starred first', () => {
    expect(names({ inside: 'name' })).toEqual([
      'harborline',
      'ledger-core',
      'cascadia',
      'notify-relay',
      'payments-api',
    ]);
  });

  it('falls back to the name when recency ties or is missing', () => {
    const projects: ReadonlyArray<{ name: string; starredAt?: IsoDateTime }> = [
      { name: 'notify-relay' },
      { name: 'ledger-core' },
    ];

    expect(
      starredProjectsFirst({ projects, inside: 'recency' }).map((project) => project.name),
    ).toEqual(['ledger-core', 'notify-relay']);
  });

  it('returns an empty list for no projects', () => {
    expect(starredProjectsFirst({ projects: [], inside: 'name' })).toEqual([]);
  });
});
