import { describe, expect, it } from 'vitest';
import type { Agent, IsoDateTime, ProviderRunId, TurnState } from '@goodboy/types';
import { aSession, anAgent, TEST_NOW } from '@goodboy/types/testing';
import { liveCheckWorkOf } from './liveCheckWorkOf';

const sessionId = aSession().id;
const url = 'https://github.com/harborline/payments-api/actions/runs/31/job/42';
const runId: ProviderRunId = JSON.parse(JSON.stringify('run-1'));
const at: IsoDateTime = TEST_NOW;
const analyst = anAgent({
  sessionId,
  ordinal: 1,
  kind: 'debugger',
  status: 'completed',
  sourceKind: 'failed_check',
  sourceCommentUrl: url,
});
const fixer = (overrides: Partial<Agent>): Agent =>
  anAgent({
    sessionId,
    ordinal: 2,
    kind: 'implementer',
    status: 'running',
    sourceKind: 'failed_check',
    sourceCommentUrl: url,
    parentAgentId: analyst.id,
    ...overrides,
  });

type Params = {
  readonly fix: Agent;
  readonly fixTurn?: TurnState;
};

const stateOf = ({ fix, fixTurn }: Params) => ({
  sessionPhaseRuns: { [sessionId]: [analyst, fix] },
  transcripts: {
    [analyst.id]: [
      { kind: 'user_text' as const, runId, text: 'kickoff', at },
      {
        kind: 'assistant_text' as const,
        runId,
        delta: 'Cause found.\n\n## Proposed fix\nGuard the retry.',
        at,
      },
    ],
  },
  agentTurnState: {
    [analyst.id]: { kind: 'ended' as const, endedAt: at },
    ...(fixTurn === undefined ? {} : { [fix.id]: fixTurn }),
  },
  dismissedCheckProposals: {},
  checkFixCommits: {},
  mountGithub: {},
});

describe('live check work', () => {
  it('counts a running fixer as live', () => {
    const work = liveCheckWorkOf({
      state: stateOf({
        fix: fixer({ status: 'running' }),
        fixTurn: { kind: 'running', runId, startedAt: at },
      }),
      sessionId,
      mountId: null,
    });
    expect(work?.chain).toBe('fixing');
  });

  it('does not count a completed fixer whose commit is not loaded', () => {
    const work = liveCheckWorkOf({
      state: stateOf({
        fix: fixer({ status: 'completed' }),
        fixTurn: { kind: 'ended', endedAt: at },
      }),
      sessionId,
      mountId: null,
    });
    expect(work).toBeNull();
  });

  it('does not count a completed fixer with no turn state after a restart', () => {
    const work = liveCheckWorkOf({
      state: stateOf({ fix: fixer({ status: 'completed' }) }),
      sessionId,
      mountId: null,
    });
    expect(work).toBeNull();
  });
});
