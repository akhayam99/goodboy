import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProjectId } from '@goodboy/types';
import { brandedId } from '../../../features/history/testing/brandedId';
import { projectPickerGroups } from './projectPickerGroups';

type Row = {
  readonly id: ProjectId;
  readonly name: string;
  readonly starredAt?: IsoDateTime;
};

type RowParams = {
  readonly name: string;
  readonly starredAt?: string;
};

type NamesParams = {
  readonly rows: ReadonlyArray<Row>;
};

type IdsParams = {
  readonly names: ReadonlyArray<string>;
};

const row = ({ name, starredAt }: RowParams): Row => ({
  id: brandedId<ProjectId>({ value: name }),
  name,
  ...(starredAt !== undefined && { starredAt: brandedId<IsoDateTime>({ value: starredAt }) }),
});

const names = ({ rows }: NamesParams) => rows.map((entry) => entry.name);

const idsOf = ({ names: list }: IdsParams) => list.map((value) => brandedId<ProjectId>({ value }));

const PROJECTS = [
  row({ name: 'payments-api' }),
  row({ name: 'northwind', starredAt: '2026-10-02T00:00:00Z' }),
  row({ name: 'acme-web' }),
  row({ name: 'notify-relay' }),
  row({ name: 'harborline', starredAt: '2026-10-03T00:00:00Z' }),
  row({ name: 'ledger-core' }),
  row({ name: 'cascadia' }),
  row({ name: 'acme-docs' }),
  row({ name: 'acme-ops' }),
];

describe('projectPickerGroups', () => {
  it('puts starred by name first, then recent by use without the starred, then the rest', () => {
    const groups = projectPickerGroups({
      projects: PROJECTS,
      recentIds: idsOf({ names: ['notify-relay', 'harborline', 'ledger-core', 'notify-relay'] }),
    });

    expect(names({ rows: groups.starred })).toEqual(['harborline', 'northwind']);
    expect(names({ rows: groups.recent })).toEqual(['notify-relay', 'ledger-core']);
    expect(names({ rows: groups.all })).toEqual([
      'acme-docs',
      'acme-ops',
      'acme-web',
      'cascadia',
      'payments-api',
    ]);
  });

  it('keeps at most five recent projects and skips ids that are not in the list', () => {
    const groups = projectPickerGroups({
      projects: PROJECTS,
      recentIds: idsOf({
        names: [
          'gone',
          'acme-ops',
          'acme-docs',
          'cascadia',
          'ledger-core',
          'acme-web',
          'payments-api',
        ],
      }),
    });

    expect(names({ rows: groups.recent })).toEqual([
      'acme-ops',
      'acme-docs',
      'cascadia',
      'ledger-core',
      'acme-web',
    ]);
    expect(names({ rows: groups.all })).toEqual(['notify-relay', 'payments-api']);
  });

  it('lists every project by name under All projects with no star and no use', () => {
    const groups = projectPickerGroups({
      projects: [row({ name: 'notify-relay' }), row({ name: 'acme-web' })],
      recentIds: [],
    });

    expect(groups.starred).toEqual([]);
    expect(groups.recent).toEqual([]);
    expect(names({ rows: groups.all })).toEqual(['acme-web', 'notify-relay']);
  });
});
