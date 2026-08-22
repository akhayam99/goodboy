import { describe, expect, it } from 'vitest';
import type { SessionEvent, SessionEventKind } from '@goodboy/types';
import {
  DEFAULT_ACTIVITY_FILTER,
  activityCategoryOf,
  filterTimelineEntries,
  parseActivityFilter,
  type ActivityFilter,
} from './activityFilter';
import type { TimelineTopLevelEntry } from './buildTimelineGroups';

type EventEntryParams = {
  readonly id: string;
  readonly kind: SessionEventKind;
};

const eventEntry = ({ id, kind }: EventEntryParams): TimelineTopLevelEntry => ({
  kind: 'event',
  id: `event:${id}`,
  at: '2026-08-21T10:00:00.000Z',
  event: {
    id,
    sessionId: 'session-1',
    kind,
    payload: null,
    createdAt: '2026-08-21T10:00:00.000Z',
  } as unknown as SessionEvent,
});

const agentEntry = ({
  id,
  agentKind,
}: {
  readonly id: string;
  readonly agentKind: string;
}): TimelineTopLevelEntry =>
  ({
    kind: 'agent',
    id: `agent:${id}`,
    at: '2026-08-21T10:00:00.000Z',
    ordinal: 0,
    agent: { id, name: id },
    agentKind,
    stepLabel: null,
    openQuestions: [],
    terminalQuestions: [],
    children: [],
    answers: [],
    hasDuration: false,
    chain: null,
  }) as unknown as TimelineTopLevelEntry;

describe('activityCategoryOf', () => {
  it('files every event kind under a category', () => {
    expect(activityCategoryOf({ entry: eventEntry({ id: 'a', kind: 'branch_switched' }) })).toBe(
      'worktree',
    );
    expect(activityCategoryOf({ entry: eventEntry({ id: 'b', kind: 'issue_unlinked' }) })).toBe(
      'issues',
    );
    expect(activityCategoryOf({ entry: eventEntry({ id: 'c', kind: 'pr_merged' }) })).toBe(
      'pullRequests',
    );
    expect(activityCategoryOf({ entry: eventEntry({ id: 'd', kind: 'workflow_deleted' }) })).toBe(
      'workflows',
    );
    expect(activityCategoryOf({ entry: eventEntry({ id: 'e', kind: 'decisions_changed' }) })).toBe(
      'decisions',
    );
  });

  it('files a restore with the discard it undoes', () => {
    expect(activityCategoryOf({ entry: eventEntry({ id: 'f', kind: 'workflow_restored' }) })).toBe(
      activityCategoryOf({ entry: eventEntry({ id: 'g', kind: 'workflow_discarded' }) }),
    );
    expect(activityCategoryOf({ entry: eventEntry({ id: 'h', kind: 'workflow_restored' }) })).toBe(
      'workflows',
    );
  });

  it('separates a resolver agent from an ordinary one', () => {
    expect(activityCategoryOf({ entry: agentEntry({ id: 'a', agentKind: 'resolver' }) })).toBe(
      'resolver',
    );
    expect(activityCategoryOf({ entry: agentEntry({ id: 'b', agentKind: 'implementer' }) })).toBe(
      'agents',
    );
  });
});

describe('filterTimelineEntries', () => {
  it('hides decisions by default and keeps everything else', () => {
    const entries = [
      eventEntry({ id: 'a', kind: 'decisions_changed' }),
      eventEntry({ id: 'b', kind: 'pr_merged' }),
    ];

    expect(
      filterTimelineEntries({ entries, filter: DEFAULT_ACTIVITY_FILTER }).map((entry) => entry.id),
    ).toEqual(['event:b']);
  });

  it('hides a discard and its restore together', () => {
    const filter: ActivityFilter = { ...DEFAULT_ACTIVITY_FILTER, workflows: false };
    const entries = [
      eventEntry({ id: 'a', kind: 'workflow_discarded' }),
      eventEntry({ id: 'b', kind: 'workflow_restored' }),
      eventEntry({ id: 'c', kind: 'pr_merged' }),
    ];

    expect(filterTimelineEntries({ entries, filter }).map((entry) => entry.id)).toEqual([
      'event:c',
    ]);
  });

  it('drops every row of a disabled category', () => {
    const filter: ActivityFilter = { ...DEFAULT_ACTIVITY_FILTER, pullRequests: false };
    const entries = [
      eventEntry({ id: 'a', kind: 'pr_merged' }),
      eventEntry({ id: 'b', kind: 'branch_created' }),
    ];

    expect(filterTimelineEntries({ entries, filter }).map((entry) => entry.id)).toEqual([
      'event:b',
    ]);
  });

  it('keeps an entry that belongs to no category', () => {
    const plan = {
      kind: 'plan',
      id: 'plan:1',
      at: '2026-08-21T10:00:00.000Z',
    } as unknown as TimelineTopLevelEntry;

    expect(
      filterTimelineEntries({ entries: [plan], filter: DEFAULT_ACTIVITY_FILTER }),
    ).toHaveLength(1);
  });
});

describe('parseActivityFilter', () => {
  it('falls back to the defaults on missing storage', () => {
    expect(parseActivityFilter({ raw: null })).toEqual(DEFAULT_ACTIVITY_FILTER);
  });

  it('falls back to the defaults on malformed storage', () => {
    expect(parseActivityFilter({ raw: 'not json' })).toEqual(DEFAULT_ACTIVITY_FILTER);
    expect(parseActivityFilter({ raw: '[]' })).toEqual(DEFAULT_ACTIVITY_FILTER);
  });

  it('keeps a stored choice and defaults the rest', () => {
    const parsed = parseActivityFilter({ raw: '{"decisions":true,"agents":"yes"}' });

    expect(parsed.decisions).toBe(true);
    expect(parsed.agents).toBe(DEFAULT_ACTIVITY_FILTER.agents);
  });
});
