// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import type { Session, SessionId, SessionStage, SessionViewPrefs } from '@goodboy/types';
import { layoutSessionColumn } from './layoutSessionColumn';
import { DEFAULT_PREFS } from './types';

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
}: {
  readonly all: ReadonlyArray<Session>;
  readonly prefs?: Partial<SessionViewPrefs>;
  readonly groupExpanded?: Readonly<Record<string, boolean>>;
  readonly currentSessionId?: SessionId | null;
  readonly stageBySession?: Readonly<Record<SessionId, SessionStage>>;
}) =>
  layoutSessionColumn({
    groups: [{ key: 'all', sessions: all }],
    prefs: { ...DEFAULT_PREFS, ...prefs },
    groupExpanded,
    currentSessionId,
    stageBySession,
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
    });
    expect(result.groups.map((group) => group.key)).toEqual(['attention', 'done']);
  });
});
