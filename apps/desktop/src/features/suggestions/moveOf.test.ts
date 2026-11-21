// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { keepOneUpkeep } from './keepOneUpkeep';
import { moveOf } from './moveOf';
import type { NextStepSignals } from './nextStepSignals';
import type { NextMove, SessionSuggestion } from './types';

const SESSION = brandId<SessionId>({ value: 'session-northwind' });

const SIGNALS: NextStepSignals = {
  sessionId: SESSION,
  workflowRuns: [],
  plans: [],
  consumedPlanIds: new Set(),
  openQuestionCount: 0,
  hasPullRequest: false,
  eligibleThreadCount: 0,
  mountEvents: [],
  projects: [],
};

const suggestion = (detail: string | undefined): SessionSuggestion => ({
  id: 'archive-session:session-northwind',
  kind: 'archive-session',
  priority: 52,
  band: 3,
  title: 'Archive this session',
  ...(detail !== undefined && { detail }),
  sessionId: SESSION,
  targetKey: null,
  fingerprint: 'archive-session:1',
  payload: { branchCount: 1 },
});

describe('moveOf', () => {
  it('drops a move that has no reason, so it never shows bare', () => {
    expect(moveOf({ suggestion: suggestion(undefined), signals: SIGNALS })).toBeNull();
    expect(moveOf({ suggestion: suggestion('   '), signals: SIGNALS })).toBeNull();
  });

  it('adds the reason, the place and how it ends to a move', () => {
    const move = moveOf({ suggestion: suggestion('All branches merged'), signals: SIGNALS });
    expect(move?.reason).toBe('All branches merged');
    expect(move?.place.tool).toBe('session');
    expect(move?.completesWhen).toEqual({ kind: 'move-gone' });
  });
});

describe('keepOneUpkeep', () => {
  const move = ({
    id,
    group,
  }: {
    readonly id: string;
    readonly group: NextMove['group'];
  }): NextMove => ({
    ...suggestion('x'),
    id,
    group,
    reason: 'x',
    evidence: [],
    place: { tool: 'session', mountId: null, agentId: null },
    completesWhen: { kind: 'move-gone' },
    read: null,
  });

  it('keeps every other move and drops all maintenance beside them', () => {
    const kept = keepOneUpkeep({
      moves: [move({ id: 'a', group: 'unblock' }), move({ id: 'b', group: 'upkeep' })],
    });
    expect(kept.map((item) => item.id)).toEqual(['a']);
  });

  it('keeps only the first maintenance move when nothing else is left', () => {
    const kept = keepOneUpkeep({
      moves: [move({ id: 'b', group: 'upkeep' }), move({ id: 'c', group: 'upkeep' })],
    });
    expect(kept.map((item) => item.id)).toEqual(['b']);
    expect(keepOneUpkeep({ moves: [] })).toEqual([]);
  });
});
