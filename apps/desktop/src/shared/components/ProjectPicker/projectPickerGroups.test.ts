import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProjectId } from '@goodboy/types';
import { brandedId } from '../../../features/history/testing/brandedId';
import { projectPickerGroups } from './projectPickerGroups';

type Row = {
  readonly id: ProjectId;
  readonly name: string;
  readonly starredAt?: IsoDateTime;
  readonly lastAccessedAt?: IsoDateTime;
};

type RowParams = {
  readonly name: string;
  readonly starredAt?: string;
  readonly lastAccessedAt?: string;
};

type NamesParams = {
  readonly rows: ReadonlyArray<Row>;
};

const row = ({ name, starredAt, lastAccessedAt }: RowParams): Row => ({
  id: brandedId<ProjectId>({ value: name }),
  name,
  ...(starredAt !== undefined && { starredAt: brandedId<IsoDateTime>({ value: starredAt }) }),
  ...(lastAccessedAt !== undefined && {
    lastAccessedAt: brandedId<IsoDateTime>({ value: lastAccessedAt }),
  }),
});

const names = ({ rows }: NamesParams) => rows.map((entry) => entry.name);

describe('projectPickerGroups', () => {
  it('puts the named project first, then recent, then starred, at most five', () => {
    const projects = [
      row({ name: 'acme-web' }),
      row({ name: 'cascadia', starredAt: '2026-10-01T00:00:00Z' }),
      row({ name: 'ledger-core', lastAccessedAt: '2026-10-15T10:00:00Z' }),
      row({ name: 'notify-relay', lastAccessedAt: '2026-10-15T12:00:00Z' }),
      row({ name: 'northwind', starredAt: '2026-10-02T00:00:00Z' }),
      row({ name: 'payments-api' }),
      row({ name: 'harborline', starredAt: '2026-10-03T00:00:00Z' }),
    ];

    const groups = projectPickerGroups({
      projects,
      suggestedIds: [brandedId<ProjectId>({ value: 'payments-api' })],
    });

    expect(names({ rows: groups.suggested })).toEqual([
      'payments-api',
      'notify-relay',
      'ledger-core',
      'cascadia',
      'harborline',
    ]);
    expect(names({ rows: groups.all })).toEqual(['acme-web', 'northwind']);
  });

  it('lists every project alphabetically under All projects when nothing is suggested', () => {
    const groups = projectPickerGroups({
      projects: [row({ name: 'notify-relay' }), row({ name: 'acme-web' })],
      suggestedIds: [],
    });

    expect(groups.suggested).toEqual([]);
    expect(names({ rows: groups.all })).toEqual(['acme-web', 'notify-relay']);
  });
});
