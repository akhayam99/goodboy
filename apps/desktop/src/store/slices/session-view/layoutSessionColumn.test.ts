// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import type {
  MountId,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
  SessionSortKey,
  SessionStage,
  SessionViewPrefs,
} from '@goodboy/types';
import { sessionMatchesProjectFilter } from '../sessionFilters/sessionMatchesProjectFilter';
import { layoutSessionColumn } from './layoutSessionColumn';
import { sortAndGroupSessions } from './sortAndGroupSessions';
import { DEFAULT_PREFS, FOLD_LIMIT, PINNED_GROUP_KEY, type SessionProjectRef } from './types';

const sessions = (count: number): ReadonlyArray<Session> =>
  Array.from({ length: count }, (_, index) =>
    aSession({ id: `session-${index + 1}` as SessionId, goal: `Session ${index + 1}` }),
  );

const layout = ({
  all,
  prefs = {},
  groupExpanded = {},
  currentSessionId = null,
  stageBySession = {},
  pinnedIds = [],
}: {
  readonly all: ReadonlyArray<Session>;
  readonly prefs?: Partial<SessionViewPrefs>;
  readonly groupExpanded?: Readonly<Record<string, boolean>>;
  readonly currentSessionId?: SessionId | null;
  readonly stageBySession?: Readonly<Record<SessionId, SessionStage>>;
  readonly pinnedIds?: ReadonlyArray<SessionId>;
}) =>
  layoutSessionColumn({
    groups: [{ key: 'all', sessions: all }],
    prefs: { ...DEFAULT_PREFS, ...prefs },
    groupExpanded,
    currentSessionId,
    stageBySession,
    pinnedIds,
  });

describe('the fold after eight rows', () => {
  it('shows eight rows and counts the rest', () => {
    const result = layout({ all: sessions(22) });
    expect(result.groups[0]?.sessions).toHaveLength(8);
    expect(result.hiddenCount).toBe(14);
    expect(result.order).toHaveLength(8);
  });

  it('folds nothing when eight or fewer rows exist', () => {
    const result = layout({ all: sessions(8) });
    expect(result.hiddenCount).toBe(0);
    expect(result.groups[0]?.sessions).toHaveLength(8);
  });

  it('shows every row once the fold is open', () => {
    const result = layout({ all: sessions(22), prefs: { isFoldOpen: true } });
    expect(result.groups[0]?.sessions).toHaveLength(22);
    expect(result.hiddenCount).toBe(0);
  });

  it('never folds a session that needs you', () => {
    const all = sessions(12);
    const waiting = all[10]?.id as SessionId;
    const result = layout({ all, stageBySession: { [waiting]: 'attention' } });
    expect(result.groups[0]?.sessions.map((session) => session.id)).toContain(waiting);
    expect(result.hiddenCount).toBe(3);
  });

  it('never folds the open session, so its pages stay in view', () => {
    const all = sessions(12);
    const open = all[11]?.id as SessionId;
    const result = layout({ all, currentSessionId: open });
    expect(result.order).toContain(open);
    expect(result.order.at(-1)).toBe(open);
  });

  it('keeps the order of the list when it pulls a row out of the fold', () => {
    const all = sessions(10);
    const waiting = all[9]?.id as SessionId;
    const result = layout({ all, stageBySession: { [waiting]: 'attention' } });
    expect(result.order).toEqual([...all.slice(0, 8), all[9]].map((session) => session?.id));
  });
});

describe('grouped columns', () => {
  const groups = [
    { key: 'attention', sessions: sessions(1) },
    { key: 'done', sessions: sessions(12).slice(1) },
  ];

  it('does not fold a group and counts it whole', () => {
    const result = layoutSessionColumn({
      groups,
      prefs: { ...DEFAULT_PREFS, group: 'stage' },
      groupExpanded: { done: true },
      currentSessionId: null,
      stageBySession: {},
      pinnedIds: [],
    });
    expect(result.isGrouped).toBe(true);
    expect(result.groups.map((group) => group.sessions.length)).toEqual([1, 11]);
    expect(result.hiddenCount).toBe(0);
  });

  it('collapses done work by default and leaves it out of the order', () => {
    const result = layoutSessionColumn({
      groups,
      prefs: { ...DEFAULT_PREFS, group: 'stage' },
      groupExpanded: {},
      currentSessionId: null,
      stageBySession: {},
      pinnedIds: [],
    });
    expect(result.groups[1]?.isCollapsed).toBe(true);
    expect(result.order).toHaveLength(1);
  });

  it('drops empty groups', () => {
    const result = layoutSessionColumn({
      groups: [{ key: 'attention', sessions: [] }, ...groups],
      prefs: { ...DEFAULT_PREFS, group: 'stage' },
      groupExpanded: {},
      currentSessionId: null,
      stageBySession: {},
      pinnedIds: [],
    });
    expect(result.groups.map((group) => group.key)).toEqual(['attention', 'done']);
  });
});

const PROJECTS: ReadonlyArray<SessionProjectRef> = [
  { id: 'project-ledger-core', name: 'ledger-core' },
  { id: 'project-notify-relay', name: 'notify-relay' },
  { id: 'project-payments-api', name: 'payments-api' },
];

const FLEET_SIZE = 14;

const fleet: ReadonlyArray<Session> = Array.from({ length: FLEET_SIZE }, (_, index) =>
  aSession({
    id: `session-${index + 1}` as SessionId,
    goal: `Harborline task ${String.fromCharCode(90 - index)}`,
    createdAt:
      `2026-09-${String(index + 1).padStart(2, '0')}T09:00:00.000Z` as Session['createdAt'],
    updatedAt:
      `2026-10-${String(((index * 5) % 14) + 1).padStart(2, '0')}T09:00:00.000Z` as Session['updatedAt'],
  }),
);

const projectOf = (session: Session): SessionProjectRef => {
  const index = fleet.indexOf(session);
  return PROJECTS[index % PROJECTS.length] as SessionProjectRef;
};

const mountOf = (session: Session): SessionProjectMount => ({
  mountId: `mount-${session.id}` as MountId,
  sessionId: session.id as SessionId,
  projectId: projectOf(session).id as ProjectId,
  mountName: projectOf(session).name,
  worktreePath: `/tmp/${session.id}`,
  lastWorktreePath: null,
  repoRoot: `/tmp/${projectOf(session).name}`,
  branch: `hl/${session.id}`,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const STAGES: ReadonlyArray<SessionStage> = ['building', 'running', 'attention', 'review', 'done'];

const stageBySession = Object.fromEntries(
  fleet.map((session, index) => [session.id, STAGES[index % STAGES.length]]),
) as Readonly<Record<SessionId, SessionStage>>;

const projectBySession = Object.fromEntries(
  fleet.map((session) => [session.id, projectOf(session)]),
) as Readonly<Record<SessionId, SessionProjectRef>>;

const idOf = (index: number): SessionId => fleet[index - 1]?.id as SessionId;

const PINNED: ReadonlyArray<SessionId> = [idOf(12), idOf(3), idOf(5)];
const CURRENT = idOf(5);

const SORTS: ReadonlyArray<SessionSortKey> = ['needsYou', 'updatedAt', 'goal', 'createdAt'];
const GROUPS: ReadonlyArray<SessionViewPrefs['group']> = ['none', 'pr', 'stage', 'project'];
const FILTERS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ['every project', []],
  ['two projects', [PROJECTS[0]?.id ?? '', PROJECTS[1]?.id ?? '']],
];

type MatrixCase = readonly [
  string,
  SessionSortKey,
  SessionViewPrefs['group'],
  ReadonlyArray<string>,
  boolean,
];

const MATRIX: ReadonlyArray<MatrixCase> = SORTS.flatMap((sort) =>
  GROUPS.flatMap((group) =>
    FILTERS.flatMap(([filterName, selected]) =>
      [false, true].map((isFoldOpen): MatrixCase => [
        `${sort} sort, ${group} group, ${filterName}, fold ${isFoldOpen ? 'open' : 'closed'}`,
        sort,
        group,
        selected,
        isFoldOpen,
      ]),
    ),
  ),
);

const layoutFor = ({
  sort,
  group,
  selected,
  isFoldOpen,
  pinnedIds = PINNED,
  groupExpanded = {},
}: {
  readonly sort: SessionSortKey;
  readonly group: SessionViewPrefs['group'];
  readonly selected: ReadonlyArray<string>;
  readonly isFoldOpen: boolean;
  readonly pinnedIds?: ReadonlyArray<SessionId>;
  readonly groupExpanded?: Readonly<Record<string, boolean>>;
}) => {
  const prefs = { ...DEFAULT_PREFS, sort, group, isFoldOpen };
  const filtered = fleet.filter((session) =>
    sessionMatchesProjectFilter({ mounts: [mountOf(session)], selectedProjectIds: selected }),
  );
  const groups = sortAndGroupSessions({
    sessions: filtered,
    prefs,
    githubState: {},
    stageBySession,
    projectBySession,
  });
  return {
    filtered,
    layout: layoutSessionColumn({
      groups,
      prefs,
      groupExpanded,
      currentSessionId: CURRENT,
      stageBySession,
      pinnedIds,
    }),
  };
};

describe('the Pinned group', () => {
  it.each(MATRIX)('%s', (_name, sort, group, selected, isFoldOpen) => {
    const { filtered, layout: result } = layoutFor({ sort, group, selected, isFoldOpen });
    const shownPins = PINNED.filter((id) => filtered.some((session) => session.id === id));
    const listed = result.groups.flatMap((column) => column.sessions.map((session) => session.id));
    const rest = filtered.filter((session) => !shownPins.includes(session.id as SessionId));

    expect(shownPins.length).toBeGreaterThan(0);
    expect(result.groups[0]?.key).toBe(PINNED_GROUP_KEY);
    expect(result.groups[0]?.label).toBe('Pinned');
    expect(result.groups[0]?.isCollapsed).toBe(false);
    expect(result.groups[0]?.sessions.map((session) => session.id)).toEqual(shownPins);
    expect(result.groups[0]?.total).toBe(shownPins.length);
    expect(new Set(listed).size).toBe(listed.length);
    expect(new Set(result.order).size).toBe(result.order.length);
    expect(result.order.slice(0, shownPins.length)).toEqual(shownPins);
    for (const id of result.order) {
      expect(listed).toContain(id);
    }
    const listedRest = result.groups.slice(1).flatMap((column) => column.sessions);
    expect(listedRest.every((session) => !shownPins.includes(session.id as SessionId))).toBe(true);
    if (group === 'none') {
      expect(result.hiddenCount + listedRest.length).toBe(rest.length);
    } else {
      expect(result.hiddenCount).toBe(0);
      expect(result.groups.slice(1).reduce((sum, column) => sum + column.total, 0)).toBe(
        rest.length,
      );
    }
  });

  it('shows pinned sessions that the fold would hide and counts only the rest as hidden', () => {
    const all = sessions(22);
    const pinned = [all[20]?.id, all[21]?.id] as ReadonlyArray<SessionId>;
    const result = layout({ all, pinnedIds: pinned });
    expect(result.groups[0]?.sessions.map((session) => session.id)).toEqual(pinned);
    expect(result.groups[1]?.sessions).toHaveLength(FOLD_LIMIT);
    expect(result.hiddenCount).toBe(20 - FOLD_LIMIT);
    expect(result.order).toHaveLength(2 + FOLD_LIMIT);
  });

  it('never folds the Pinned group itself', () => {
    const all = sessions(20);
    const pinned = all.slice(0, 12).map((session) => session.id as SessionId);
    const result = layout({ all, pinnedIds: pinned });
    expect(result.groups[0]?.sessions).toHaveLength(12);
    expect(result.groups[0]?.total).toBe(12);
    expect(result.hiddenCount).toBe(0);
  });

  it('keeps the open session once, under Pinned, when it is pinned', () => {
    const all = sessions(12);
    const open = all[11]?.id as SessionId;
    const result = layout({ all, currentSessionId: open, pinnedIds: [open] });
    expect(result.order.filter((id) => id === open)).toHaveLength(1);
    expect(result.groups[0]?.sessions.map((session) => session.id)).toEqual([open]);
    expect(result.groups[1]?.sessions.map((session) => session.id)).not.toContain(open);
  });

  it('drops a group whose every session is pinned and takes pinned sessions out of group totals', () => {
    const groups = [
      { key: 'attention', sessions: sessions(1) },
      { key: 'running', sessions: sessions(4).slice(1) },
    ];
    const result = layoutSessionColumn({
      groups,
      prefs: { ...DEFAULT_PREFS, group: 'stage' },
      groupExpanded: {},
      currentSessionId: null,
      stageBySession: {},
      pinnedIds: ['session-1' as SessionId, 'session-2' as SessionId],
    });
    expect(result.groups.map((group) => group.key)).toEqual([PINNED_GROUP_KEY, 'running']);
    expect(result.groups.map((group) => group.total)).toEqual([2, 2]);
  });

  it('ignores a pin for a session that is not listed and a pin that repeats', () => {
    const all = sessions(5);
    const result = layout({
      all,
      pinnedIds: ['session-9' as SessionId, 'session-2' as SessionId, 'session-2' as SessionId],
    });
    expect(result.groups[0]?.sessions.map((session) => session.id)).toEqual(['session-2']);
    expect(result.order.filter((id) => id === 'session-2')).toHaveLength(1);
  });

  it('adds no group when nothing is pinned or nothing pinned is listed', () => {
    const all = sessions(5);
    expect(layout({ all }).groups.map((group) => group.key)).toEqual(['all']);
    expect(
      layout({ all, pinnedIds: ['session-9' as SessionId] }).groups.map((group) => group.key),
    ).toEqual(['all']);
  });

  it('collapses with its toggle in a grouped list and leaves the keyboard order while collapsed', () => {
    const result = layoutSessionColumn({
      groups: [{ key: 'running', sessions: sessions(5) }],
      prefs: { ...DEFAULT_PREFS, group: 'stage' },
      groupExpanded: { [PINNED_GROUP_KEY]: false },
      currentSessionId: null,
      stageBySession: {},
      pinnedIds: ['session-2' as SessionId],
    });
    expect(result.groups[0]?.isCollapsed).toBe(true);
    expect(result.groups[1]?.isCollapsed).toBe(false);
    expect(result.order).not.toContain('session-2');
    expect(result.order).toContain('session-1');
  });

  it('never collapses in a flat list, where its header is a plain label with no toggle', () => {
    const result = layout({
      all: sessions(5),
      pinnedIds: ['session-2' as SessionId],
      groupExpanded: { [PINNED_GROUP_KEY]: false, all: false },
    });
    expect(result.groups.map((group) => group.isCollapsed)).toEqual([false, false]);
    expect(result.order).toContain('session-2');
  });

  it('labels the rest of a flat list only while something is pinned', () => {
    const all = sessions(5);
    expect(layout({ all }).groups.map((group) => group.label)).toEqual([null]);
    expect(
      layout({ all, pinnedIds: ['session-2' as SessionId] }).groups.map((group) => group.label),
    ).toEqual(['Pinned', 'Other sessions']);
  });
});
