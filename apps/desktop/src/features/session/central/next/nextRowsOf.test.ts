import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import type { SessionSuggestion } from '../../../suggestions/types';
import { actionCardsOf, type AutoActionTarget } from './actionCardsOf';
import { nextRowsOf } from './nextRowsOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const HOME = brandId<MountId>({ value: 'mount-home' });
const ROOT = brandId<AgentId>({ value: 'agent-auto-rollout' });

type ChildParams = {
  readonly key: string;
  readonly kind: AutoActionTarget['kind'];
  readonly mountId: MountId | null;
};

const childOf = ({ key, kind, mountId }: ChildParams): AutoActionTarget => ({
  agentId: brandId<AgentId>({ value: `agent-${key}` }),
  rootAgentId: ROOT,
  role: key,
  noun: 'Tester',
  kind,
  reason: null,
  reasonCode: null,
  mountId,
  plan: null,
  canRetry: true,
});

const FIX_CHECKS: SessionSuggestion = {
  id: `fix-checks:${HOME}`,
  kind: 'fix-checks',
  priority: 20,
  band: 1,
  title: 'Fix the failing lint check',
  sessionId: SESSION_ID,
  fingerprint: `fix-checks:${HOME}`,
  targetKey: `pr:${HOME}`,
  payload: { mountId: HOME, projectName: 'harbor-portal', prNumber: 9995 },
};

const PUSH: SessionSuggestion = {
  id: `push-branch:${HOME}`,
  kind: 'push-branch',
  priority: 41,
  band: 2,
  title: 'Push 3 commits',
  sessionId: SESSION_ID,
  fingerprint: `push-branch:${HOME}:ahead`,
  targetKey: `branch:${HOME}`,
  payload: {
    mountId: HOME,
    projectId: brandId({ value: 'project-harbor' }),
    projectName: 'harbor-portal',
    branch: 'hl/feat-center-home-page',
    worktreePath: '/work/home',
    state: 'ahead',
    ahead: 3,
    behind: 0,
  },
};

describe('nextRowsOf', () => {
  it('shows a branch once per group, the worst blocker first and the rest folded', () => {
    const rows = nextRowsOf({
      cards: actionCardsOf({
        owners: [],
        suggestions: [FIX_CHECKS],
        autoTargets: [
          childOf({ key: 'tester', kind: 'timedOut', mountId: HOME }),
          childOf({ key: 'implementer', kind: 'childBlocked', mountId: HOME }),
        ],
      }),
    });

    expect(rows.map((row) => row.id)).toEqual(['auto:agent-implementer:childBlocked']);
    expect(rows[0]?.folded.map((card) => card.id)).toEqual([
      'auto:agent-tester:timedOut',
      `suggestion:fix-checks:${HOME}`,
    ]);
    expect(rows[0]?.detail).toBe('The tester is blocked, and 2 more.');
  });

  it('folds the questions an Auto run asked into its plan row as questions, not more', () => {
    const rows = nextRowsOf({
      cards: actionCardsOf({
        owners: [],
        suggestions: [
          {
            id: `answer-questions:${SESSION_ID}`,
            kind: 'answer-questions',
            priority: 0,
            band: 0,
            title: 'Answer open questions',
            sessionId: SESSION_ID,
            fingerprint: `answer-questions:${SESSION_ID}:2`,
            targetKey: null,
            payload: { count: 2, firstQuestion: null, rootAgentId: ROOT },
          },
        ],
        autoTargets: [
          {
            ...childOf({ key: 'auto', kind: 'approve', mountId: null }),
            agentId: ROOT,
            plan: { name: 'Center pages rollout', version: 3, branchCount: 0 },
          },
        ],
      }),
    });

    expect(rows.map((row) => row.id)).toEqual([`auto:${ROOT}:approve`]);
    expect(rows[0]?.folded.map((card) => card.id)).toEqual([
      `suggestion:answer-questions:${SESSION_ID}`,
    ]);
    expect(rows[0]?.detail).toBe('Plan v3 waits on your OK, and 2 questions.');
  });

  it('keeps the same branch apart when the work is in another group', () => {
    const rows = nextRowsOf({
      cards: actionCardsOf({
        owners: [],
        suggestions: [FIX_CHECKS, PUSH],
        autoTargets: [],
      }),
    });

    expect(rows.map((row) => [row.id, row.folded.length])).toEqual([
      [`suggestion:fix-checks:${HOME}`, 0],
      [`suggestion:push-branch:${HOME}`, 0],
    ]);
  });

  it('keeps two children without a branch as two rows', () => {
    const rows = nextRowsOf({
      cards: actionCardsOf({
        owners: [],
        suggestions: [],
        autoTargets: [
          childOf({ key: 'scout', kind: 'neverStarted', mountId: null }),
          childOf({ key: 'docs', kind: 'failed', mountId: null }),
        ],
      }),
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.folded.length === 0)).toBe(true);
  });
});
