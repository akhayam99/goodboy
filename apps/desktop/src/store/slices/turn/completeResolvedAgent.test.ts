import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderId,
  ResolveThread,
  Session,
  SessionId,
  StepId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import { createResolveSlice } from '../resolve';
import { resolveInitialState } from '../resolve/state';
import { buildResolutionReplyBody } from '../github/buildResolutionReplyBody';
import { threadOutcome } from '../resolve/threadOutcome';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  invokeAgentList: vi.fn(async () => [] as ReadonlyArray<Agent>),
  invokeAgentUpdateStatus: vi.fn(async () => undefined),
  summarizeStepOutput: vi.fn(async () => 'the model summary'),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return { ...actual, summarizeStepOutput: h.summarizeStepOutput };
});

const resolveMockState = vi.hoisted(() => ({ reset: (): void => {} }));
beforeEach(() => resolveMockState.reset());

vi.mock('@goodboy/db', async () => {
  const queries = (
    await import('../resolve/testing/createResolveQueryMocks')
  ).createResolveQueryMocks();
  resolveMockState.reset = queries.resetResolveQueryMocks;
  return {
    ...queries,
    listOpenQuestionsForSession: vi.fn(async () => []),
  };
});

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.invokeAgentList,
  invokeAgentUpdateStatus: h.invokeAgentUpdateStatus,
}));

import { completeResolvedAgent } from './completeResolvedAgent';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const NOW = '2026-07-30T00:00:00.000Z' as IsoDateTime;

const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'resolver',
  kind: 'resolver',
  status: 'running',
  sourceThreadIds: ['PRRT_1'],
};

const session: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'resolve the review threads',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const plannerStepAgent: Agent = {
  ...agent,
  name: 'plan the work',
  kind: 'planner',
  stepId: 'step-1' as StepId,
  workflowRunId: 'run-1' as WorkflowRunId,
};

type Harness = {
  readonly state: {
    sessionPhaseRuns: Record<SessionId, ReadonlyArray<Agent>>;
    agentKindOverride: Record<AgentId, never>;
    sessionResolveThreads: Record<SessionId, ReadonlyArray<ResolveThread>>;
    refreshUnreadWorkspaces: ReturnType<typeof vi.fn>;
    emitNotification: ReturnType<typeof vi.fn>;
  };
  readonly set: SetFn;
  readonly get: GetFn;
  readonly actions: ReturnType<typeof createResolveSlice>;
};

type HarnessParams = Record<string, never>;

const createHarness = ({}: HarnessParams): Harness => {
  const state = {
    ...resolveInitialState,
    sessionActiveProject: {},
    sessionProjectMounts: {},
    sessionGithub: {},
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    agentKindOverride: {},
    sessions: [session],
    projects: [],
    providers: [
      {
        id: 'anthropic' as ProviderId,
        binary: 'claude',
        capabilities: PROVIDER_CAPABILITIES.anthropic,
        connection: 'connected' as const,
        version: null,
        identity: null,
      },
    ],
    providerCooldowns: {},
    workspaceOverrides: {},
    phaseTemplates: {},
    sessionWorkflows: {},
    refreshUnreadWorkspaces: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
  };
  const set = ((update: unknown) => {
    if (typeof update === 'function') {
      Object.assign(state, update(state));
      return;
    }
    Object.assign(state, update);
  }) as SetFn;
  const get = (() => state) as unknown as GetFn;
  const actions = createResolveSlice({ set, get });
  Object.assign(state, actions);
  h.invokeAgentList.mockImplementation(async () => state.sessionPhaseRuns[SESSION_ID] ?? []);
  return { state, set, get, actions };
};

type OutcomeParams = { readonly state: Harness['state']; readonly threadId: string };
const rowFor = ({ state, threadId }: OutcomeParams): ResolveThread | undefined =>
  (state.sessionResolveThreads[SESSION_ID] ?? []).find((row) => row.threadId === threadId);
const outcomeFor = ({ state, threadId }: OutcomeParams) => {
  const row = rowFor({ state, threadId });
  return row === undefined ? null : threadOutcome({ row });
};
const settledThreadIds = ({ state }: { readonly state: Harness['state'] }) =>
  (state.sessionResolveThreads[SESSION_ID] ?? [])
    .filter((row) => threadOutcome({ row }) !== null)
    .map((row) => row.threadId);

describe('completeResolvedAgent', () => {
  it('uses verdict thread ids when a legacy resolver has no source thread ids', async () => {
    const { state, set, get } = createHarness({});
    state.sessionPhaseRuns[SESSION_ID] = [{ ...agent, sourceThreadIds: undefined }];
    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">>',
      now: () => NOW,
    });
    expect(rowFor({ state, threadId: 'PRRT_1' })).toMatchObject({
      state: 'fixed',
      disposition: 'fix',
      commitShas: ['abcdef1234567890'],
    });
  });

  beforeEach(() => {
    h.invokeAgentList.mockClear();
    h.invokeAgentUpdateStatus.mockClear();
  });

  it('uses the analysis summary as the explanation posted on closure', async () => {
    const { state, set, get } = createHarness({});
    const summary = 'The existing guard already rejects an empty value.';

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: `<<comment-analysis threadId="PRRT_1" verdict="wontfix" summary="${summary}">>`,
      now: () => NOW,
    });

    const outcome = outcomeFor({ state, threadId: 'PRRT_1' });
    expect(outcome).toEqual({ kind: 'analyzed', reply: summary, verdict: 'wontfix' });
    expect(
      buildResolutionReplyBody({ closure: outcome ?? undefined, prUrl: null, isAttributed: false }),
    ).toBe(summary);
  });

  it('keeps an agent that fixed two threads and asked about a third in needs-you', async () => {
    const { state, set, get } = createHarness({});
    state.sessionPhaseRuns = {
      [SESSION_ID]: [{ ...agent, sourceThreadIds: ['PRRT_1', 'PRRT_2', 'PRRT_3'] }],
    };

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText:
        '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">> <<comment-resolved threadId="PRRT_2" commitSha="abcdef1234567890">>',
      now: () => NOW,
    });

    expect(settledThreadIds({ state })).toEqual(['PRRT_1', 'PRRT_2']);
    expect(outcomeFor({ state, threadId: 'PRRT_3' })).toBeNull();
  });

  it('settles an agent as committed once every owned thread has an outcome', async () => {
    const { state, set, get } = createHarness({});
    state.sessionPhaseRuns = {
      [SESSION_ID]: [{ ...agent, sourceThreadIds: ['PRRT_1', 'PRRT_2'] }],
    };

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText:
        '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">> <<comment-wontfix threadId="PRRT_2" reason="intentional">>',
      now: () => NOW,
    });

    expect(settledThreadIds({ state })).toEqual(['PRRT_1', 'PRRT_2']);
  });

  it('lets a later marker supersede a settled thread without wiping its siblings', async () => {
    const { state, set, get, actions } = createHarness({});
    state.sessionPhaseRuns = {
      [SESSION_ID]: [{ ...agent, sourceThreadIds: ['PRRT_1', 'PRRT_2'] }],
    };
    await actions.persistResolveTurn({
      sessionId: SESSION_ID,
      agent: state.sessionPhaseRuns[SESSION_ID]![0]!,
      assistantText:
        '<<comment-wontfix threadId="PRRT_1" reason="the branch is unreachable">> <<comment-analysis threadId="PRRT_2" verdict="wontfix" summary="already covered">>',
    });

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">>',
      now: () => NOW,
    });

    expect(outcomeFor({ state, threadId: 'PRRT_1' })).toEqual({
      kind: 'resolved',
      commitSha: 'abcdef1234567890',
    });
    expect(outcomeFor({ state, threadId: 'PRRT_2' })).toEqual({
      kind: 'analyzed',
      reply: 'already covered',
      verdict: 'wontfix',
    });
  });

  it('records an amended sha on the row a first turn already settled', async () => {
    const { state, set, get, actions } = createHarness({});
    const oldSha = 'aaaaaaaaaaaaaaaa';
    const newSha = 'bbbbbbbbbbbbbbbb';
    await actions.persistResolveTurn({
      sessionId: SESSION_ID,
      agent,
      assistantText: `<<comment-resolved threadId="PRRT_1" commitSha="${oldSha}">>`,
    });

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: `<<comment-resolved threadId="PRRT_1" commitSha="${newSha}">>`,
      now: () => NOW,
    });

    expect(rowFor({ state, threadId: 'PRRT_1' })).toMatchObject({
      state: 'fixed',
      commitShas: [newSha],
    });
  });

  it('does not downgrade a resolved marker for the same thread', async () => {
    const { state, set, get } = createHarness({});

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText:
        '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">> <<comment-wontfix threadId="PRRT_1" reason="not needed">> <<comment-analysis threadId="PRRT_1" verdict="wontfix" summary="no change needed">>',
      now: () => NOW,
    });

    expect(outcomeFor({ state, threadId: 'PRRT_1' })).toEqual({
      kind: 'resolved',
      commitSha: 'abcdef1234567890',
    });
  });

  it('persists the model summary of a plain non-workflow agent without notifying the inbox', async () => {
    const { state, set, get } = createHarness({});
    state.sessionPhaseRuns = {
      [SESSION_ID]: [{ ...agent, kind: 'implementer', sourceThreadIds: undefined }],
    };

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: 'did the thing, no markers here',
      now: () => NOW,
    });

    expect(h.summarizeStepOutput).toHaveBeenCalledWith(
      expect.objectContaining({ output: 'did the thing, no markers here' }),
    );
    expect(h.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ status: 'completed', outputSummary: 'the model summary' }),
    );
    expect(state.emitNotification).not.toHaveBeenCalled();
  });

  it('persists a marked fallback when the summarizer fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    h.summarizeStepOutput.mockRejectedValueOnce(new Error('provider unavailable'));
    const { state, set, get } = createHarness({});
    state.sessionPhaseRuns = {
      [SESSION_ID]: [{ ...agent, kind: 'implementer', sourceThreadIds: undefined }],
    };

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: 'did the thing, no markers here',
      now: () => NOW,
    });

    expect(h.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({
        outputSummary: '[unsummarized step output, carried whole]\ndid the thing, no markers here',
      }),
    );
  });

  it('keeps resolver marker processing on the original assistant text', async () => {
    const { state, set, get } = createHarness({});
    const assistantText =
      '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">> <<comment-analysis threadId="PRRT_1" verdict="fixed" summary="rewrote the guard">>';

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText,
      now: () => NOW,
    });

    expect(outcomeFor({ state, threadId: 'PRRT_1' })).toEqual({
      kind: 'resolved',
      commitSha: 'abcdef1234567890',
    });
    expect(h.summarizeStepOutput).toHaveBeenCalledWith(
      expect.objectContaining({ output: assistantText }),
    );
  });

  it('queues review comments read from the original assistant text', async () => {
    const { state, set, get } = createHarness({});
    const queueAgentReviewComments = vi.fn(async () => undefined);
    Object.assign(state, { queueAgentReviewComments });
    state.sessionPhaseRuns = {
      [SESSION_ID]: [{ ...agent, kind: 'pr-reviewer', sourceThreadIds: undefined }],
    };
    const assistantText =
      'reviewed it\n<<review-comment path="src/auth.ts" line="12" body="guard the null case">>';

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText,
      now: () => NOW,
    });

    expect(queueAgentReviewComments).toHaveBeenCalledWith(
      SESSION_ID,
      AGENT_ID,
      expect.arrayContaining([expect.objectContaining({ path: 'src/auth.ts' })]),
    );
    expect(h.summarizeStepOutput).toHaveBeenCalledWith(
      expect.objectContaining({ output: assistantText }),
    );
  });
  it('counts a plan artifact envelope as the workflow step output', async () => {
    const { state, set, get } = createHarness({});
    const finalizeWorkflowStep = vi.fn(async () => ({ shouldAutoAdvance: true }));
    Object.assign(state, { finalizeWorkflowStep });
    state.sessionPhaseRuns = { [SESSION_ID]: [plannerStepAgent] };
    const body = JSON.stringify({
      title: 'Ship it',
      format: 'markdown',
      content: 'step one',
    });

    const advance = await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: `<<artifact v=1 kind=plan>>\n${body}\n<</artifact>>`,
      now: () => NOW,
    });

    expect(finalizeWorkflowStep).toHaveBeenCalledWith(
      SESSION_ID,
      AGENT_ID,
      expect.any(String),
      true,
    );
    expect(advance).toBe(true);
  });

  it('still counts the legacy plan marker as the workflow step output', async () => {
    const { state, set, get } = createHarness({});
    const finalizeWorkflowStep = vi.fn(async () => ({ shouldAutoAdvance: true }));
    Object.assign(state, { finalizeWorkflowStep });
    state.sessionPhaseRuns = { [SESSION_ID]: [plannerStepAgent] };

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: '<<plan>>\nShip it\nstep one\n<</plan>>',
      now: () => NOW,
    });

    expect(finalizeWorkflowStep).toHaveBeenCalledWith(
      SESSION_ID,
      AGENT_ID,
      expect.any(String),
      true,
    );
  });

  it('leaves the step open when the plan arrives with a blocking question', async () => {
    const { state, set, get } = createHarness({});
    const finalizeWorkflowStep = vi.fn(async () => ({ shouldAutoAdvance: false }));
    Object.assign(state, { finalizeWorkflowStep });
    state.sessionPhaseRuns = { [SESSION_ID]: [plannerStepAgent] };
    const body = JSON.stringify({
      title: 'Ship it',
      format: 'markdown',
      content: 'step one',
    });
    const question =
      '<<ctx-question suggestions="renew the key|drop the provider" recommended="renew the key" select="one" blocking="true">>renew the expired key?<</ctx-question>>';

    const advance = await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: `${question}\n<<artifact v=1 kind=plan>>\n${body}\n<</artifact>>`,
      now: () => NOW,
    });

    expect(finalizeWorkflowStep).toHaveBeenCalledWith(
      SESSION_ID,
      AGENT_ID,
      expect.any(String),
      false,
    );
    expect(advance).toBe(false);
  });

  it('does not let a report envelope stand in for the plan a step owes', async () => {
    const { state, set, get } = createHarness({});
    const finalizeWorkflowStep = vi.fn(async () => ({ shouldAutoAdvance: false }));
    Object.assign(state, { finalizeWorkflowStep });
    state.sessionPhaseRuns = { [SESSION_ID]: [plannerStepAgent] };
    const body = JSON.stringify({ title: 'Report', format: 'markdown', content: '## Outcome' });

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: `<<artifact v=1 kind=report>>\n${body}\n<</artifact>>`,
      now: () => NOW,
    });

    expect(finalizeWorkflowStep).toHaveBeenCalledWith(
      SESSION_ID,
      AGENT_ID,
      expect.any(String),
      false,
    );
  });

  it('leaves a thread the agent does not own out of its rows', async () => {
    const { state, set, get } = createHarness({});
    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: '<<comment-resolved threadId="PRRT_OTHER" commitSha="abcdef1234567890">>',
      now: () => NOW,
    });
    expect(rowFor({ state, threadId: 'PRRT_OTHER' })).toBeUndefined();
  });
});
