import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { aSession, anAgent, TEST_NOW } from '@goodboy/types/testing';
import { selectCheckChain } from './selectCheckChain';
import { selectFixOffers } from './selectFixOffers';

const sessionId = aSession().id;
const url = 'https://github.com/harborline/payments-api/actions/runs/31/job/42';
const runId: ProviderRunId = JSON.parse(JSON.stringify('run-1'));
const at: IsoDateTime = TEST_NOW;
const PROPOSAL = 'Cause found.\n\n## Proposed fix\nGuard the retry in src/ledger.ts.';
const transcript: ReadonlyArray<TurnEvent> = [
  { kind: 'user_text', runId, text: 'kickoff', at },
  { kind: 'assistant_text', runId, delta: PROPOSAL, at },
];

const KIND_PAIRS = [
  { name: 'the CI roles', analyst: 'ci-debugger', fixer: 'ci-fixer' },
  { name: 'the roles an older version stored', analyst: 'debugger', fixer: 'implementer' },
] as const;

describe.each(KIND_PAIRS)('the check chain with $name', ({ analyst, fixer }) => {
  const analysis = anAgent({
    sessionId,
    ordinal: 1,
    kind: analyst,
    status: 'completed',
    sourceKind: 'failed_check',
    sourceCommentUrl: url,
  });
  const fix = anAgent({
    sessionId,
    ordinal: 2,
    kind: fixer,
    status: 'running',
    sourceKind: 'failed_check',
    sourceCommentUrl: url,
    parentAgentId: analysis.id,
  });
  const stateOf = (agents: ReadonlyArray<typeof analysis>) => ({
    sessionPhaseRuns: { [sessionId]: agents },
    transcripts: { [analysis.id]: transcript },
    agentTurnState: { [analysis.id]: { kind: 'ended' as const, endedAt: at } },
    dismissedCheckProposals: { [sessionId]: [] },
    checkFixCommits: {},
  });

  it('finds the analysis and offers the fix', () => {
    const state = stateOf([analysis]);
    const chain = selectCheckChain({ state, sessionId, url });
    expect(chain.state).toBe('proposal');
    expect(chain.debugger?.id).toBe(analysis.id);
    expect(selectFixOffers({ state, sessionId })).toContain(analysis.id);
  });
  it('finds the fix as the child of the analysis', () => {
    const chain = selectCheckChain({ state: stateOf([analysis, fix]), sessionId, url });
    expect(chain.state).toBe('fixing');
    expect(chain.fix?.id).toBe(fix.id);
  });
});
