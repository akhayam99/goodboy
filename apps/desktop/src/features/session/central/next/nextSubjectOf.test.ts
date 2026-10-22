import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import type { SessionSuggestion } from '../../../suggestions/types';
import { actionCardsOf, type AutoActionTarget } from './actionCardsOf';
import { nextSubjectOf } from './nextSubjectOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const HOME = brandId<MountId>({ value: 'mount-home' });
const ROOT = brandId<AgentId>({ value: 'agent-auto-rollout' });

const CHILD: AutoActionTarget = {
  agentId: brandId<AgentId>({ value: 'agent-home-implementer' }),
  rootAgentId: ROOT,
  role: 'Build the hero',
  noun: 'Implementer',
  kind: 'childBlocked',
  reason: null,
  reasonCode: 'declared_blocked',
  mountId: HOME,
  plan: null,
  canRetry: true,
};

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

const REBASE: SessionSuggestion = {
  id: `rebase-project:${SESSION_ID}`,
  kind: 'rebase-project',
  priority: 40,
  band: 2,
  title: 'Rebase harbor-portal',
  sessionId: SESSION_ID,
  fingerprint: `rebase-project:${SESSION_ID}`,
  targetKey: null,
  payload: { targets: [] },
};

type SourcesParams = {
  readonly autoTargets?: ReadonlyArray<AutoActionTarget>;
  readonly suggestions?: ReadonlyArray<SessionSuggestion>;
};

const subjectsOf = ({ autoTargets = [], suggestions = [] }: SourcesParams) =>
  actionCardsOf({ owners: [], suggestions, autoTargets }).map((card) => nextSubjectOf({ card }));

describe('nextSubjectOf', () => {
  it('keys a plan approval by its Auto run', () => {
    const [subject] = subjectsOf({
      autoTargets: [{ ...CHILD, agentId: ROOT, kind: 'approve', mountId: null }],
    });

    expect(subject).toEqual({ kind: 'plan', key: `plan:${ROOT}`, rootAgentId: ROOT });
  });

  it('keys questions by the Auto run that asked them, and keeps unlinked ones on their own', () => {
    const answer: SessionSuggestion = {
      id: `answer-questions:${SESSION_ID}`,
      kind: 'answer-questions',
      priority: 0,
      band: 0,
      title: 'Answer open questions',
      sessionId: SESSION_ID,
      fingerprint: `answer-questions:${SESSION_ID}:2`,
      targetKey: null,
      payload: { count: 2, firstQuestion: null, rootAgentId: ROOT },
    };
    const unlinked: SessionSuggestion = {
      ...answer,
      id: 'answer-questions:old',
      payload: { count: 1, firstQuestion: null, rootAgentId: null },
    };

    expect(subjectsOf({ suggestions: [answer, unlinked] }).map((subject) => subject.key)).toEqual([
      'own:suggestion:answer-questions:old',
      `plan:${ROOT}`,
    ]);
  });

  it('gives a stuck child and a failing check on the same branch one key', () => {
    const subjects = subjectsOf({ autoTargets: [CHILD], suggestions: [FIX_CHECKS] });

    expect(subjects.map((subject) => [subject.kind, subject.key])).toEqual([
      ['branch', `branch:${HOME}`],
      ['pr', `branch:${HOME}`],
    ]);
  });

  it('keeps a session wide card and a card without a branch on their own', () => {
    const subjects = subjectsOf({
      autoTargets: [{ ...CHILD, mountId: null }],
      suggestions: [REBASE],
    });

    expect(subjects.map((subject) => subject.key)).toEqual([
      `own:auto:${CHILD.agentId}:childBlocked`,
      `own:suggestion:${REBASE.id}`,
    ]);
  });
});
