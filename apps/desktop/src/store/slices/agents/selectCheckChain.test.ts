import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { aSession, anAgent, TEST_NOW } from '@goodboy/types/testing';
import { selectCheckChain } from './selectCheckChain';
import { selectFixOffers } from './selectFixOffers';
import { selectCheckPushOffers } from './selectCheckPushOffers';
import type { CheckFixCommit } from '../check-fix-commits/types';

const sessionId = aSession().id;
const url = 'https://github.com/harborline/payments-api/actions/runs/31/job/42';
const runId: ProviderRunId = JSON.parse(JSON.stringify('run-1'));
const at: IsoDateTime = TEST_NOW;
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
  readonly fact?: CheckFixCommit;
};

const stateOf = ({
  agents,
  text = PROPOSAL,
  debuggerTurn = 'ended',
  fixEvents,
  dismissed = [],
  fact,
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
  checkFixCommits: fact === undefined ? {} : { [agents[agents.length - 1]!.id]: fact },
});

const LOCAL: CheckFixCommit = {
  kind: 'found',
  sha: '9e4c1a7',
  subject: 'Guard the retry',
  count: 1,
  unpushed: 1,
};
const PUSHED: CheckFixCommit = { ...LOCAL, unpushed: 0 };
const NONE: CheckFixCommit = { kind: 'none' };
const UNREADABLE: CheckFixCommit = { kind: 'unreadable' };
const QUIET_COMMIT: ReadonlyArray<TurnEvent> = [
  {
    kind: 'tool_call_start',
    runId,
    toolUseId: 't2',
    toolName: 'Bash',
    input: { command: 'git commit -qam "fix retry" && git log --oneline -1' },
    at,
  },
  {
    kind: 'tool_call_end',
    runId,
    toolUseId: 't2',
    output: '9e4c1a7 fix retry\n',
    isError: false,
    at,
  },
];

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
      name: 'fixed-local when the commit is not pushed',
      params: {
        agents: [debuggerAgent, fixAgent({ status: 'completed' })],
        fact: LOCAL,
      },
      state: 'fixed-local',
    },
    {
      name: 'fixed-pushed when the commit is on the remote',
      params: {
        agents: [debuggerAgent, fixAgent({ status: 'completed' })],
        fact: PUSHED,
      },
      state: 'fixed-pushed',
    },
    {
      name: 'fixing while the git answer is pending',
      params: { agents: [debuggerAgent, fixAgent({ status: 'completed' })] },
      state: 'fixing',
    },
    {
      name: 'fix-failed when the child failed',
      params: { agents: [debuggerAgent, fixAgent({ status: 'failed' })] },
      state: 'fix-failed',
    },
    {
      name: 'fix-failed when git finds no new commit',
      params: {
        agents: [debuggerAgent, fixAgent({ status: 'completed' })],
        fixEvents: commitEvents,
        fact: NONE,
      },
      state: 'fix-failed',
    },
    {
      name: 'fix-failed when git is unreadable and the transcript has no commit',
      params: {
        agents: [debuggerAgent, fixAgent({ status: 'completed' })],
        fixEvents: [],
        fact: UNREADABLE,
      },
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
  it('reads the commit and count from git, not from the transcript', () => {
    const done = fixAgent({ status: 'completed' });
    const chain = selectCheckChain({
      state: stateOf({
        agents: [debuggerAgent, done],
        fixEvents: [],
        fact: { ...LOCAL, count: 2, unpushed: 2 },
      }),
      sessionId,
      url,
    });
    expect(chain.commit).toBe('9e4c1a7');
    expect(chain.commitCount).toBe(2);
  });
  it('detects a quiet commit from git log --oneline when git cannot be read', () => {
    const done = fixAgent({ status: 'completed' });
    const chain = selectCheckChain({
      state: stateOf({
        agents: [debuggerAgent, done],
        fixEvents: QUIET_COMMIT,
        fact: UNREADABLE,
      }),
      sessionId,
      url,
    });
    expect(chain.state).toBe('fixed-local');
    expect(chain.commit).toBe('9e4c1a7');
  });
  it('trusts git over a bracketed commit in the transcript', () => {
    const done = fixAgent({ status: 'completed' });
    const chain = selectCheckChain({
      state: stateOf({
        agents: [debuggerAgent, done],
        fixEvents: commitEvents,
        fact: NONE,
      }),
      sessionId,
      url,
    });
    expect(chain.state).toBe('fix-failed');
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
  it('offers Push only on the Debugger row of a chain fixed on the branch', () => {
    const done = fixAgent({ status: 'completed' });
    expect(
      selectCheckPushOffers({
        state: stateOf({ agents: [debuggerAgent, done], fact: LOCAL }),
        sessionId,
      }),
    ).toBe(`${debuggerAgent.id}|${url}`);
    expect(
      selectCheckPushOffers({
        state: stateOf({ agents: [debuggerAgent, done], fact: PUSHED }),
        sessionId,
      }),
    ).toBe('');
    expect(selectCheckPushOffers({ state: stateOf({ agents: [debuggerAgent] }), sessionId })).toBe(
      '',
    );
  });
});
