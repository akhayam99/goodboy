// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import type { TrackerMove } from '../../store/slices/tracker-moves/types';
import { actionCardsOf } from '../session/central/next/actionCardsOf';
import { nextKindFactsOf } from '../session/central/next/nextKindFactsOf';
import { nextRowsOf } from '../session/central/next/nextRowsOf';
import { deriveNextSteps } from './deriveNextSteps';
import { trackerMoveSuggestionOf } from './trackerMoveSuggestionOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

const moveOf = (overrides: Partial<TrackerMove> = {}): TrackerMove => ({
  key: 'linear:issue-412',
  provider: 'linear',
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
  projectId: null,
  externalId: 'issue-412',
  identifier: 'HBL-412',
  title: 'Retried webhooks post a second credit',
  fromName: 'In Progress',
  toName: 'Done',
  target: { kind: 'linear', stateId: 'state-done', fromStateId: 'state-progress' },
  ...overrides,
});

const baseParams = {
  sessionId: SESSION_ID,
  workflowRuns: [],
  plans: [],
  consumedPlanIds: new Set<never>(),
  openQuestionCount: 0,
  firstOpenQuestion: null,
  questionsRootAgentId: null,
  hasPullRequest: true,
  eligibleThreadCount: 0,
  mountEvents: [],
  projects: [],
  agents: [],
  mounts: [],
  checkChains: [],
  settledBranches: { merged: 0, closed: 0 },
  isActivityShown: false,
  hasGoal: true,
  hasEverAttachedWorkflow: true,
  recommendedWorkflow: null,
} as const;

describe('trackerMoveSuggestionOf', () => {
  it('names the item, the state it moves to and the state it is in now', () => {
    const suggestion = trackerMoveSuggestionOf({ sessionId: SESSION_ID, move: moveOf() });

    expect(suggestion).toMatchObject({
      id: 'move-tracker-item:linear:issue-412',
      kind: 'move-tracker-item',
      title: 'Move HBL-412 to Done',
      detail: 'Now In Progress in Linear',
      band: 3,
    });
  });

  it('names Jira for a Jira item', () => {
    const suggestion = trackerMoveSuggestionOf({
      sessionId: SESSION_ID,
      move: moveOf({ provider: 'jira', key: 'jira:10042', fromName: 'In Review' }),
    });

    expect(suggestion.detail).toBe('Now In Review in Jira');
  });

  it('changes its fingerprint when the item sits in another state, so a dismissal does not hide it', () => {
    const first = trackerMoveSuggestionOf({ sessionId: SESSION_ID, move: moveOf() });
    const second = trackerMoveSuggestionOf({
      sessionId: SESSION_ID,
      move: moveOf({ fromName: 'In Review' }),
    });

    expect(first.fingerprint).not.toBe(second.fingerprint);
  });
});

describe('the Next list with a tracker move', () => {
  const rowsFor = (moves: ReadonlyArray<TrackerMove>) =>
    nextRowsOf({
      cards: actionCardsOf({
        owners: [],
        autoTargets: [],
        suggestions: deriveNextSteps({ ...baseParams, trackerMoves: moves }),
      }),
    });

  it('shows one Ship row per item', () => {
    const rows = rowsFor([
      moveOf(),
      moveOf({ key: 'jira:10042', provider: 'jira', identifier: 'HBL-9' }),
    ]);

    expect(rows.map((row) => row.title)).toEqual(['Move HBL-9 to Done', 'Move HBL-412 to Done']);
    expect(rows.map((row) => nextKindFactsOf({ card: row }).group)).toEqual(['ship', 'ship']);
  });

  it('shows no row without a move', () => {
    expect(rowsFor([])).toEqual([]);
  });

  it('puts the move before the worktree cleanup and the archive', () => {
    const cards = actionCardsOf({
      owners: [],
      autoTargets: [],
      suggestions: [trackerMoveSuggestionOf({ sessionId: SESSION_ID, move: moveOf() })],
    });

    expect(cards.map((card) => nextKindFactsOf({ card }))).toEqual([{ group: 'ship', rank: 4 }]);
  });
});
