import { describe, expect, it } from 'vitest';
import type { SessionEvent, SessionEventKind } from '@goodboy/types';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_LABEL,
  ACTIVITY_FILTER_PRESETS,
  ACTIVITY_GROUPS,
  DEFAULT_ACTIVITY_FILTER,
  activityCategoryOf,
  activityCounts,
  activityFilterPresetOf,
  activityToggleLabel,
  hiddenActivityToggles,
  activityChildOf,
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

const planEntry = (): TimelineTopLevelEntry =>
  ({
    kind: 'plan',
    id: 'plan:1',
    at: '2026-08-21T10:00:00.000Z',
    plan: { id: 'plan-1', title: 'Round once per batch' },
  }) as unknown as TimelineTopLevelEntry;

const artifactEntry = ({
  kind,
}: {
  readonly kind: 'report' | 'wireframe';
}): TimelineTopLevelEntry =>
  ({
    kind: 'artifact',
    id: `artifact:${kind}`,
    at: '2026-08-21T10:05:00.000Z',
    artifact: { id: `artifact-${kind}`, kind, title: 'Settlement review' },
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

  it('files a plan, a report and a wireframe under the artifacts category', () => {
    expect(activityCategoryOf({ entry: planEntry() })).toBe('artifacts');
    expect(activityCategoryOf({ entry: artifactEntry({ kind: 'report' }) })).toBe('artifacts');
    expect(activityCategoryOf({ entry: artifactEntry({ kind: 'wireframe' }) })).toBe('artifacts');
  });

  it('gives each artifact kind its own child toggle', () => {
    expect(activityChildOf({ entry: planEntry() })).toBe('plans');
    expect(activityChildOf({ entry: artifactEntry({ kind: 'report' }) })).toBe('reports');
    expect(activityChildOf({ entry: artifactEntry({ kind: 'wireframe' }) })).toBe('wireframes');
    expect(activityChildOf({ entry: eventEntry({ id: 'a', kind: 'pr_merged' }) })).toBeNull();
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
    const plan = planEntry();

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

  it('hides one artifact kind without touching the others', () => {
    const entries = [
      planEntry(),
      artifactEntry({ kind: 'report' }),
      artifactEntry({ kind: 'wireframe' }),
    ];

    expect(
      filterTimelineEntries({
        entries,
        filter: { ...DEFAULT_ACTIVITY_FILTER, reports: false },
      }).map((entry) => entry.id),
    ).toEqual(['plan:1', 'artifact:wireframe']);
  });

  it('hides every artifact kind once the artifacts category is off', () => {
    const entries = [
      planEntry(),
      artifactEntry({ kind: 'report' }),
      artifactEntry({ kind: 'wireframe' }),
    ];

    expect(
      filterTimelineEntries({ entries, filter: { ...DEFAULT_ACTIVITY_FILTER, artifacts: false } }),
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

describe('the removed suggestions category', () => {
  it('is gone from the category list, its toggle and label with it', () => {
    expect(ACTIVITY_CATEGORIES).not.toContain('suggestions');
    expect('suggestions' in ACTIVITY_CATEGORY_LABEL).toBe(false);
    expect('suggestions' in DEFAULT_ACTIVITY_FILTER).toBe(false);
  });

  it('tolerates a payload stored before the toggle was removed, ignoring the stray key', () => {
    const parsed = parseActivityFilter({ raw: '{"worktree":false,"suggestions":false}' });
    expect(parsed).toEqual({ ...DEFAULT_ACTIVITY_FILTER, worktree: false });
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

  it('carries a stored plans choice onto the artifacts category and its kinds', () => {
    const parsed = parseActivityFilter({ raw: '{"worktree":false,"plans":false}' });

    expect(parsed.artifacts).toBe(false);
    expect(parsed.plans).toBe(false);
    expect(parsed.reports).toBe(false);
    expect(parsed.wireframes).toBe(false);
    expect(parsed.worktree).toBe(false);
    expect(parsed.agents).toBe(true);
  });

  it('leaves a stored artifacts payload alone', () => {
    const parsed = parseActivityFilter({
      raw: '{"artifacts":true,"plans":false,"reports":true,"wireframes":false}',
    });

    expect(parsed.artifacts).toBe(true);
    expect(parsed.plans).toBe(false);
    expect(parsed.reports).toBe(true);
    expect(parsed.wireframes).toBe(false);
  });

  it('defaults the artifact toggles on a payload that never stored plans', () => {
    const parsed = parseActivityFilter({ raw: '{"worktree":false}' });

    expect(parsed.artifacts).toBe(true);
    expect(parsed.plans).toBe(true);
    expect(parsed.reports).toBe(true);
    expect(parsed.wireframes).toBe(true);
  });

  it('honors a stored subagent choice on either flag', () => {
    expect(parseActivityFilter({ raw: '{"workflowSubagents":false}' }).workflowSubagents).toBe(
      false,
    );
    expect(parseActivityFilter({ raw: '{"agentSubagents":false}' }).agentSubagents).toBe(false);
  });
});

describe('ACTIVITY_GROUPS', () => {
  it('files every category in exactly one group', () => {
    const grouped = ACTIVITY_GROUPS.flatMap((group) => group.categories);

    expect([...grouped].sort()).toEqual([...ACTIVITY_CATEGORIES].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('names the groups Work, Outputs and Session log', () => {
    expect(ACTIVITY_GROUPS.map((group) => group.label)).toEqual(['Work', 'Outputs', 'Session log']);
  });
});

describe('activity presets', () => {
  it('reads the default filter as Everything', () => {
    expect(activityFilterPresetOf({ filter: DEFAULT_ACTIVITY_FILTER })).toBe('everything');
    expect(ACTIVITY_FILTER_PRESETS.everything).toEqual(DEFAULT_ACTIVITY_FILTER);
  });

  it('keeps only the Work group and its children on the Work preset', () => {
    const work = ACTIVITY_FILTER_PRESETS.work;

    expect(work.agents && work.agentSubagents && work.workflowSubagents).toBe(true);
    expect(work.questions).toBe(true);
    expect(work.artifacts || work.plans || work.pullRequests || work.decisions).toBe(false);
    expect(activityFilterPresetOf({ filter: work })).toBe('work');
  });

  it('reads any other mix as custom', () => {
    expect(
      activityFilterPresetOf({ filter: { ...DEFAULT_ACTIVITY_FILTER, decisions: false } }),
    ).toBeNull();
  });
});

describe('hiddenActivityToggles', () => {
  it('lists a hidden parent once and leaves its children out', () => {
    const filter: ActivityFilter = {
      ...DEFAULT_ACTIVITY_FILTER,
      artifacts: false,
      plans: false,
      session: false,
    };

    expect(hiddenActivityToggles({ filter })).toEqual(['artifacts', 'session']);
  });

  it('lists a hidden child under a shown parent in panel order', () => {
    const filter: ActivityFilter = {
      ...DEFAULT_ACTIVITY_FILTER,
      wireframes: false,
      resolver: false,
      workflowSubagents: false,
    };

    expect(hiddenActivityToggles({ filter })).toEqual([
      'workflowSubagents',
      'wireframes',
      'resolver',
    ]);
  });

  it('names a child by what it belongs to', () => {
    expect(activityToggleLabel({ toggle: 'workflowSubagents' })).toBe('Workflow subagents');
    expect(activityToggleLabel({ toggle: 'session' })).toBe('Session events');
  });
});

describe('activityCounts', () => {
  it('counts rows per category, artifacts per kind and subagents under their parent', () => {
    const parent = {
      ...(agentEntry({ id: 'lead', agentKind: 'generic' }) as object),
      children: [
        { ...(agentEntry({ id: 'sub-1', agentKind: 'generic' }) as object), children: [] },
        {
          ...(agentEntry({ id: 'sub-2', agentKind: 'generic' }) as object),
          children: [agentEntry({ id: 'sub-2-1', agentKind: 'generic' })],
        },
      ],
    } as unknown as TimelineTopLevelEntry;
    const run = {
      kind: 'run',
      id: 'run:1',
      at: '2026-08-21T10:00:00.000Z',
      children: [
        agentEntry({ id: 'step-1', agentKind: 'implementer' }),
        { ...(planEntry() as object), id: 'plan:run' },
      ],
    } as unknown as TimelineTopLevelEntry;

    const counts = activityCounts({
      entries: [
        parent,
        agentEntry({ id: 'resolver', agentKind: 'resolver' }),
        run,
        planEntry(),
        artifactEntry({ kind: 'report' }),
        eventEntry({ id: 'e1', kind: 'pr_created' }),
      ],
    });

    expect(counts.agents).toBe(1);
    expect(counts.agentSubagents).toBe(3);
    expect(counts.resolver).toBe(1);
    expect(counts.workflows).toBe(1);
    expect(counts.workflowSubagents).toBe(1);
    expect(counts.artifacts).toBe(2);
    expect(counts.plans).toBe(2);
    expect(counts.reports).toBe(1);
    expect(counts.wireframes).toBe(0);
    expect(counts.pullRequests).toBe(1);
  });
});
