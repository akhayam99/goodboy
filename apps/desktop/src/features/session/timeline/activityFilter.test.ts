import { describe, expect, it } from 'vitest';
import type { SessionEvent, SessionEventKind } from '@goodboy/types';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_LABEL,
  DEFAULT_ACTIVITY_FILTER,
  activityCategoryOf,
  filterTimelineEntries,
  parseActivityFilter,
  readActivityFilter,
  writeActivityFilter,
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

  it('files a plan under its own category', () => {
    const plan = {
      kind: 'plan',
      id: 'plan:1',
      at: '2026-08-21T10:00:00.000Z',
    } as unknown as TimelineTopLevelEntry;

    expect(activityCategoryOf({ entry: plan })).toBe('plans');
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
  it('shows decisions by default alongside everything else', () => {
    const entries = [
      eventEntry({ id: 'a', kind: 'decisions_changed' }),
      eventEntry({ id: 'b', kind: 'pr_merged' }),
    ];

    expect(
      filterTimelineEntries({ entries, filter: DEFAULT_ACTIVITY_FILTER }).map((entry) => entry.id),
    ).toEqual(['event:a', 'event:b']);
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

  it('shows a plan by default and hides it when plans are off', () => {
    const plan = {
      kind: 'plan',
      id: 'plan:1',
      at: '2026-08-21T10:00:00.000Z',
    } as unknown as TimelineTopLevelEntry;

    expect(
      filterTimelineEntries({ entries: [plan], filter: DEFAULT_ACTIVITY_FILTER }),
    ).toHaveLength(1);
    expect(
      filterTimelineEntries({
        entries: [plan],
        filter: { ...DEFAULT_ACTIVITY_FILTER, plans: false },
      }),
    ).toHaveLength(0);
  });

  it('leaves entries alone when only subagents are collapsed', () => {
    const entries = [
      eventEntry({ id: 'a', kind: 'pr_merged' }),
      agentEntry({ id: 'b', agentKind: 'implementer' }),
    ];

    expect(
      filterTimelineEntries({
        entries,
        filter: { ...DEFAULT_ACTIVITY_FILTER, workflowSubagents: false, agentSubagents: false },
      }),
    ).toHaveLength(2);
  });
});

describe('the suggestions category', () => {
  it('sits in the category list, labelled and on by default', () => {
    expect(ACTIVITY_CATEGORIES).toContain('suggestions');
    expect(ACTIVITY_CATEGORY_LABEL.suggestions).toBe('Suggestions');
    expect(DEFAULT_ACTIVITY_FILTER.suggestions).toBe(true);
  });

  it('defaults to on for a payload stored before it existed', () => {
    expect(parseActivityFilter({ raw: '{"worktree":false}' }).suggestions).toBe(true);
  });

  it('round trips a hidden choice through storage', () => {
    localStorage.clear();
    writeActivityFilter({ filter: { ...DEFAULT_ACTIVITY_FILTER, suggestions: false } });

    const stored = readActivityFilter();

    expect(stored.suggestions).toBe(false);
    expect(stored.worktree).toBe(true);
    localStorage.clear();
  });

  it('keeps the mount proposal events with the worktree category', () => {
    expect(
      activityCategoryOf({
        entry: eventEntry({ id: 'p', kind: 'project_materialization_proposed' }),
      }),
    ).toBe('worktree');
    expect(
      activityCategoryOf({
        entry: eventEntry({ id: 'q', kind: 'project_materialization_dismissed' }),
      }),
    ).toBe('worktree');
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

  it('gives an old payload the defaults for plans and both subagent flags', () => {
    const parsed = parseActivityFilter({
      raw: '{"worktree":false,"issues":true,"pullRequests":true,"workflows":true,"agents":true,"resolver":true,"decisions":true}',
    });

    expect(parsed.worktree).toBe(false);
    expect(parsed.plans).toBe(true);
    expect(parsed.workflowSubagents).toBe(true);
    expect(parsed.agentSubagents).toBe(true);
  });

  it('honors a stored subagent choice on either flag', () => {
    expect(parseActivityFilter({ raw: '{"workflowSubagents":false}' }).workflowSubagents).toBe(
      false,
    );
    expect(parseActivityFilter({ raw: '{"agentSubagents":false}' }).agentSubagents).toBe(false);
  });
});
