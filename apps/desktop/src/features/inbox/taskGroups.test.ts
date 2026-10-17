// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nextProjectId } from '@goodboy/types/testing';
import type { InboxRecord } from './types';
import { taskGroupsOf } from './taskGroups';

const LEDGER = nextProjectId();
const NOTIFY = nextProjectId();

const record = (overrides: Partial<InboxRecord> & Pick<InboxRecord, 'key'>): InboxRecord => ({
  provider: 'linear',
  kind: 'issue',
  identifier: 'HBL-1',
  title: 'Ledger export times out',
  state: 'active',
  stateLabel: 'In progress',
  updatedAt: '2026-10-01T10:00:00Z',
  url: '',
  context: '',
  payload: {
    provider: 'linear',
    kind: 'issue',
    issue: {
      id: '1',
      identifier: 'HBL-1',
      title: 'Ledger export times out',
      description: null,
      url: '',
      state: { name: 'In progress', type: 'started' },
      team: { key: 'HBL' },
      updatedAt: '',
    },
    sessionId: null,
  },
  ...overrides,
});

const RECORDS: ReadonlyArray<InboxRecord> = [
  record({ key: 'linear:1', updatedAt: '2026-10-01T10:00:00Z', projectIds: [LEDGER] }),
  record({ key: 'linear:2', updatedAt: '2026-10-03T10:00:00Z', projectIds: [LEDGER] }),
  record({
    key: 'linear:3',
    state: 'open',
    stateLabel: 'Todo',
    updatedAt: '2026-10-02T10:00:00Z',
  }),
  record({
    key: 'github:1',
    provider: 'github',
    state: 'open',
    stateLabel: 'Open',
    projectIds: [NOTIFY],
  }),
  record({ key: 'sentry:1', provider: 'sentry', state: 'alert', stateLabel: 'Unresolved' }),
];

const NAMES = { [LEDGER]: 'ledger-core', [NOTIFY]: 'notify-relay' };

const summary = (groupBy: Parameters<typeof taskGroupsOf>[0]['groupBy']) =>
  taskGroupsOf({ records: RECORDS, groupBy, projectNames: NAMES }).map((group) => [
    group.label,
    group.records.map((item) => item.key),
  ]);

describe('taskGroupsOf', () => {
  it('groups by source, largest first, newest first inside a group', () => {
    expect(summary('source')).toEqual([
      ['Linear', ['linear:2', 'linear:3', 'linear:1']],
      ['GitHub', ['github:1']],
      ['Sentry', ['sentry:1']],
    ]);
  });

  it('groups by source and status word, the urgent state first', () => {
    expect(summary('status').map(([label]) => label)).toEqual([
      'Sentry · Unresolved',
      'Linear · In progress',
      'GitHub · Open',
      'Linear · Todo',
    ]);
  });

  it('groups by project, with the unmapped records last', () => {
    expect(summary('project')).toEqual([
      ['ledger-core', ['linear:2', 'linear:1']],
      ['notify-relay', ['github:1']],
      ['No project', ['linear:3', 'sentry:1']],
    ]);
  });

  it('keeps one group when grouping is off', () => {
    expect(summary('none')).toEqual([
      ['All tasks', ['linear:2', 'linear:3', 'github:1', 'linear:1', 'sentry:1']],
    ]);
  });

  it('returns no group for no records', () => {
    expect(taskGroupsOf({ records: [], groupBy: 'source', projectNames: {} })).toEqual([]);
  });
});
