import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { aSession, anAgent, TEST_NOW } from '@goodboy/types/testing';
import { selectCheckChain } from './selectCheckChain';
import { selectFixOffers } from './selectFixOffers';

const sessionId = aSession().id;
const url = 'https://github.com/harborline/payments-api/actions/runs/31/job/42';
const runId = 'run-1' as ProviderRunId;
const at = TEST_NOW as IsoDateTime;
const debuggerAgent = anAgent({
  sessionId,
  ordinal: 1,
  kind: 'debugger',
  status: 'completed',
  sourceKind: 'failed_check',
  sourceCommentUrl: url,
});
const fixAgent = (overrides: Partial<Agent> = {}): Agent =>
  anAgent({
    sessionId,
    ordinal: 2,
    kind: 'implementer',
    status: 'running',
    sourceKind: 'failed_check',
    sourceCommentUrl: url,
    parentAgentId: debuggerAgent.id,
    ...overrides,
  });

const say = (delta: string): ReadonlyArray<TurnEvent> => [
  { kind: 'user_text', runId, text: 'kickoff', at },
  { kind: 'assistant_text', runId, delta, at },
];
const PROPOSAL = 'Cause found.\n\n## Proposed fix\nGuard the retry in src/ledger.ts.';
const commitEvents: ReadonlyArray<TurnEvent> = [
  {
    kind: 'tool_call_start',
    runId,
    toolUseId: 't1',
    toolName: 'Bash',
    input: { command: 'git commit -m fix' },
    at,
  },
  {
    kind: 'tool_call_end',
    runId,
    toolUseId: 't1',
    output: '[acme/fix-credits 9e4c1a7] fix',
    isError: false,
    at,
  },
];

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly text?: string;
  readonly debuggerTurn?: 'ended' | 'running';
  readonly fixEvents?: ReadonlyArray<TurnEvent>;
  readonly dismissed?: ReadonlyArray<AgentId>;
};

const stateOf = ({
  agents,
  text = PROPOSAL,
  debuggerTurn = 'ended',
  fixEvents,
  dismissed = [],
}: Params) => ({
  sessionPhaseRuns: { [sessionId]: agents },
  transcripts: {
    [debuggerAgent.id]: say(text),
    ...(fixEvents === undefined ? {} : { [agents[agents.length - 1]!.id]: fixEvents }),
  },
  agentTurnState: {
    [debuggerAgent.id]:
      debuggerTurn === 'running'
        ? { kind: 'running' as const, runId, startedAt: at }
        : { kind: 'ended' as const, endedAt: at },
  },
  dismissedCheckProposals: { [sessionId]: dismissed },
});

describe('check chain states', () => {
  it.each([
    {
      name: 'analyzing',
      params: {
        agents: [{ ...debuggerAgent, status: 'running' as const }],
        debuggerTurn: 'running' as const,
      },
      state: 'analyzing',
    },
    { name: 'proposal', params: { agents: [debuggerAgent] }, state: 'proposal' },
    { name: 'fixing', params: { agents: [debuggerAgent, fixAgent()] }, state: 'fixing' },
    {
      name: 'fixed',
      params: {
        agents: [debuggerAgent, fixAgent({ status: 'completed' })],
        fixEvents: commitEvents,
      },
      state: 'fixed',
    },
    {
      name: 'fix-failed when the child failed',
      params: { agents: [debuggerAgent, fixAgent({ status: 'failed' })] },
      state: 'fix-failed',
    },
    {
      name: 'fix-failed when it ended without a commit',
      params: { agents: [debuggerAgent, fixAgent({ status: 'completed' })], fixEvents: [] },
      state: 'fix-failed',
    },
    {
      name: 'no-fix',
      params: { agents: [debuggerAgent], text: 'Could not reproduce.' },
      state: 'no-fix',
    },
    {
      name: 'dismissed proposal',
      params: { agents: [debuggerAgent], dismissed: [debuggerAgent.id] },
      state: 'no-fix',
    },
  ])('reads $name', ({ params, state }) => {
    expect(selectCheckChain({ state: stateOf(params), sessionId, url }).state).toBe(state);
  });
  it('reads the commit and treats an unloaded transcript as fixed', () => {
    const done = fixAgent({ status: 'completed' });
    expect(
      selectCheckChain({
        state: stateOf({ agents: [debuggerAgent, done], fixEvents: commitEvents }),
        sessionId,
        url,
      }).commit,
    ).toBe('9e4c1a7');
    expect(
      selectCheckChain({ state: stateOf({ agents: [debuggerAgent, done] }), sessionId, url }).state,
    ).toBe('fixed');
  });
  it('is none without a Debugger and ignores the Implementer as the analysis', () => {
    expect(selectCheckChain({ state: stateOf({ agents: [] }), sessionId, url }).state).toBe('none');
    const chain = selectCheckChain({
      state: stateOf({ agents: [debuggerAgent, fixAgent()] }),
      sessionId,
      url,
    });
    expect(chain.debugger?.id).toBe(debuggerAgent.id);
    expect(chain.fix?.kind).toBe('implementer');
  });
  it('offers Start fix only on a Debugger in proposal', () => {
    expect(selectFixOffers({ state: stateOf({ agents: [debuggerAgent] }), sessionId })).toBe(
      `${debuggerAgent.id}|${url}`,
    );
    expect(
      selectFixOffers({ state: stateOf({ agents: [debuggerAgent, fixAgent()] }), sessionId }),
    ).toBe('');
    expect(
      selectFixOffers({
        state: stateOf({ agents: [debuggerAgent], text: 'Nothing.' }),
        sessionId,
      }),
    ).toBe('');
  });
});
