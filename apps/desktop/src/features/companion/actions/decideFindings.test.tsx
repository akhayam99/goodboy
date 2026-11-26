// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../store/storyHarness')).dbModuleMock({
    updateWorkflowRunSpendLimit: vi.fn(async () => undefined),
    updateWorkflowRunOrchestrationStop: vi.fn(async () => undefined),
    updateWorkflowRunOrchestrationOutcome: vi.fn(async () => undefined),
    updateSessionWorkflowAutoRun: vi.fn(async () => undefined),
    approveAutoArtifact: vi.fn(async () => ({ kind: 'approved', revision: 3 })),
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoTreeId,
  type IsoDateTime,
  type ProviderRunId,
  type IntegrationDraft,
  type IntegrationDraftId,
  type OpenQuestion,
  type OpenQuestionId,
  type SessionId,
  type WorkflowRunId,
} from '@goodboy/types';
import { listTurnEventEntriesForAgent } from '@goodboy/db';
import { aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { workspaceIdOf } from './ids';
import { FIXTURE_TREE as TREE, aView } from '../../auto/testing/autoViewFixtures';
import { clearActionLedger } from './actionLedger';
import { clearRateSlots } from './actionLimits';
import { expectedActionIdOf } from './actionIds';
import { decidePorts } from './decidePorts';
import { executeDecideAction } from './executeDecideAction';
import type { DecidePorts } from './handlerTypes';
import { clearLimitUndos } from './limitUndos';
import { parseDecideAction } from './parseDecideAction';
import { clearPosted } from './postedSlackDrafts';
import { registerDecideScope, resetDecideScope } from './phoneScope';
import { transcriptEntriesOf, transcriptOf } from './transcriptOf';
import { clearUndelivered } from './undeliveredPermissions';
import { limitScopeOfStore, limitTargetOf } from './limitTargets';
import { runStateOf } from './targets';
import { permissionHashOf, slackDraftVersionOf } from './versions';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const WORKSPACE = 'ws-harborline';
const SESSION = brandId<SessionId>({ value: 'ses-ledger-core' });
const RUN = brandId<WorkflowRunId>({ value: 'run-ledger' });
const AGENT = brandId<AgentId>({ value: 'agent-builder' });
const LEAD = brandId<AgentId>({ value: 'agent-lead' });
const AT = brandId<IsoDateTime>({ value: '2026-11-25T10:00:00.000Z' });
const PROVIDER_RUN = brandId<ProviderRunId>({ value: 'provider-run-1' });

const questionOf = ({ value }: { readonly value: string }): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value }),
  sessionId: SESSION,
  text: 'Which currency does the ledger use?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: 'EUR',
  status: 'answered',
  createdAt: AT,
});

const ports: DecidePorts = {
  approvePlan: vi.fn(async () => ({ kind: 'approved' as const, revision: 1 })),
  setTreeCap: vi.fn(async () => ({ kind: 'applied' as const })),
};

type Fields = Readonly<Record<string, unknown>>;

type RunParams = {
  readonly kind: string;
  readonly fields: Fields;
  readonly actionId?: string;
  readonly phoneId?: string;
};

const act = async ({ kind, fields, actionId, phoneId = 'phone-1' }: RunParams) => {
  const parsed = parseDecideAction({
    raw: {
      kind,
      actionId: 'placeholder',
      workspaceId: WORKSPACE,
      sessionId: SESSION,
      ...fields,
    },
  });
  if (parsed === null) {
    throw new Error(`test action ${kind} did not parse`);
  }
  return executeDecideAction({
    action: { ...parsed, actionId: actionId ?? expectedActionIdOf({ action: parsed }) },
    phoneId,
    getStore: () => useAppStore.getState(),
    ports,
  });
};

type SeedParams = {
  readonly run?: Parameters<typeof aWorkflowRun>[0];
  readonly budget?: number;
};

const seed = ({ run = {}, budget }: SeedParams = {}) => {
  const session = aSession({
    id: SESSION,
    workspaceId: workspaceIdOf({ value: WORKSPACE }),
    workflowRuns: [aWorkflowRun({ id: RUN, ...run })],
  });
  useAppStore.setState({
    sessions: [session],
    sessionPhaseRuns: {
      [SESSION]: [anAgent({ id: AGENT, sessionId: SESSION })],
    },
    sessionBudgets:
      budget === undefined
        ? {}
        : {
            [SESSION]: {
              sessionId: SESSION,
              softCapUsd: budget,
              onExceed: 'pause',
              warnRatio: 0.8,
            },
          },
  });
};

const runOf = () =>
  useAppStore.getState().sessions[0]?.workflowRuns.find((candidate) => candidate.id === RUN);

beforeEach(async () => {
  await resetStoryStore();
  clearActionLedger();
  clearRateSlots();
  clearLimitUndos();
  clearPosted();
  clearUndelivered();
  resetDecideScope();
  vi.mocked(ports.setTreeCap).mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  stubStoryInvoke({
    session_budget_set: (args: { sessionId: string; softCapUsd: number; onExceed: string }) => ({
      ...args,
      warnRatio: 0.8,
    }),
    slack_get_thread: [],
    slack_list_thread_heads: [],
  });
});

describe('stop and continue a run', () => {
  it('stops with a resumable operator stop, never a close, and a retry still reads done', async () => {
    seed({ run: { orchestrationOutcome: 'blocked' } });
    const fields = { runId: RUN, seenState: 'waiting' };
    const first = await act({ kind: 'stopRun', fields });
    expect(first.result).toBe('done');
    expect(runOf()?.orchestrationStop?.kind).toBe('operator');
    const retry = await act({ kind: 'stopRun', fields });
    expect(retry.result).toBe('done');
    expect(runOf()?.orchestrationStop?.kind).toBe('operator');
  });

  it('reads a budget stop as paused and continues it again after a second stop', async () => {
    seed({ run: { orchestrationStop: { kind: 'budget', message: 'Spending limit reached.' } } });
    const state = useAppStore.getState();
    expect(runStateOf({ store: state, sessionId: SESSION, run: runOf()! })).toBe('paused');
    const continueRun = vi.fn(async () => undefined);
    useAppStore.setState({ continueWorkflowRun: continueRun });
    const fields = { runId: RUN, seenState: 'paused' };
    expect((await act({ kind: 'continueRun', fields })).result).toBe('done');
    expect((await act({ kind: 'continueRun', fields })).result).toBe('done');
    expect(continueRun).toHaveBeenCalledTimes(2);
  });
});

describe('the ledger', () => {
  it('does not hand a stored outcome to a phone that may no longer decide', async () => {
    seed({ budget: 10 });
    const raise = { runId: RUN, seenLimit: 10, offeredAmount: 15 };
    expect((await act({ kind: 'raiseLimit', fields: raise })).result).toBe('done');
    registerDecideScope({ read: () => false });
    const replay = await act({ kind: 'raiseLimit', fields: raise });
    expect(replay.refusal?.code).toBe('not-permitted');
    expect(replay.isReplay).toBe(false);
  });

  it('refuses fields that do not match a stored action id instead of replaying done', async () => {
    seed({ budget: 10 });
    const raise = { runId: RUN, seenLimit: 10, offeredAmount: 15 };
    const first = await act({ kind: 'raiseLimit', fields: raise });
    const mismatch = await act({
      kind: 'raiseLimit',
      fields: { ...raise, seenLimit: 99 },
      actionId: first.actionId,
    });
    expect(mismatch.refusal?.code).toBe('unknown-target');
    expect(mismatch.isReplay).toBe(false);
  });
});

describe('raise and undo a limit', () => {
  it('raises the session budget and replays a lost response, then runs a fresh raise after an undo', async () => {
    seed({ budget: 10 });
    const raise = { runId: RUN, seenLimit: 10, offeredAmount: 15 };
    const first = await act({ kind: 'raiseLimit', fields: raise });
    expect(first.result).toBe('done');
    expect(useAppStore.getState().sessionBudgets[SESSION]?.softCapUsd).toBe(15);
    const replay = await act({ kind: 'raiseLimit', fields: raise });
    expect(replay.isReplay).toBe(true);
    const undo = await act({
      kind: 'undoRaiseLimit',
      fields: { runId: RUN, raisedActionId: first.actionId },
    });
    expect(undo.result).toBe('done');
    expect(useAppStore.getState().sessionBudgets[SESSION]?.softCapUsd).toBe(10);
    const again = await act({ kind: 'raiseLimit', fields: raise });
    expect({ result: again.result, isReplay: again.isReplay }).toEqual({
      result: 'done',
      isReplay: false,
    });
    expect(useAppStore.getState().sessionBudgets[SESSION]?.softCapUsd).toBe(15);
    const undoAgain = await act({
      kind: 'undoRaiseLimit',
      fields: { runId: RUN, raisedActionId: first.actionId },
    });
    expect({ result: undoAgain.result, isReplay: undoAgain.isReplay }).toEqual({
      result: 'done',
      isReplay: false,
    });
    expect(useAppStore.getState().sessionBudgets[SESSION]?.softCapUsd).toBe(10);
  });

  it('raises the limit of the run that hit it and leaves the session budget alone', async () => {
    seed({
      run: {
        spendLimitUsd: 4,
        spendLimitMode: 'pause',
        orchestrationStop: { kind: 'budget', message: 'Spending limit reached.' },
      },
      budget: 50,
    });
    const target = limitTargetOf({
      scope: limitScopeOfStore({ store: useAppStore.getState() }),
      sessionId: SESSION,
      runId: RUN,
    });
    expect(target).toMatchObject({ kind: 'run', limit: 4 });
    const raise = { runId: RUN, seenLimit: 4, offeredAmount: 9 };
    expect((await act({ kind: 'raiseLimit', fields: raise })).result).toBe('done');
    expect(runOf()?.spendLimitUsd).toBe(9);
    expect(useAppStore.getState().sessionBudgets[SESSION]?.softCapUsd).toBe(50);
    const undo = await act({
      kind: 'undoRaiseLimit',
      fields: {
        runId: RUN,
        raisedActionId: expectedActionIdOf({
          action: parseDecideAction({
            raw: {
              kind: 'raiseLimit',
              actionId: 'x',
              workspaceId: WORKSPACE,
              sessionId: SESSION,
              ...raise,
            },
          })!,
        }),
      },
    });
    expect(undo.result).toBe('done');
    expect(runOf()?.spendLimitUsd).toBe(4);
  });

  it('raises an Auto tree cap through the cap port and refuses a stale cap', async () => {
    seed({ budget: 50 });
    useAppStore.setState({
      autoTreeViews: {
        [SESSION]: [aView({ capUsd: 10 })],
      },
    });
    const raise = { runId: TREE, seenLimit: 10, offeredAmount: 15 };
    expect((await act({ kind: 'raiseLimit', fields: raise })).result).toBe('done');
    expect(ports.setTreeCap).toHaveBeenCalledWith(
      expect.objectContaining({ treeId: TREE, expectedCapUsd: 10, capUsd: 15 }),
    );
    expect(useAppStore.getState().sessionBudgets[SESSION]?.softCapUsd).toBe(50);
    vi.mocked(ports.setTreeCap).mockResolvedValueOnce({ kind: 'stale', capUsd: 12 });
    const stale = await act({
      kind: 'raiseLimit',
      fields: { ...raise, offeredAmount: 20 },
      actionId: undefined,
    });
    expect(stale.refusal?.code).toBe('version-changed');
  });

  it('never lets an undo and a raise both pass the same check', async () => {
    seed({ budget: 10 });
    const raise = { runId: RUN, seenLimit: 10, offeredAmount: 15 };
    const first = await act({ kind: 'raiseLimit', fields: raise });
    const [undo, next] = await Promise.all([
      act({ kind: 'undoRaiseLimit', fields: { runId: RUN, raisedActionId: first.actionId } }),
      act({ kind: 'raiseLimit', fields: { runId: RUN, seenLimit: 15, offeredAmount: 25 } }),
    ]);
    expect(undo.result).toBe('done');
    expect(next.refusal?.code).toBe('version-changed');
    expect(useAppStore.getState().sessionBudgets[SESSION]?.softCapUsd).toBe(10);
  });
});

describe('slack reply', () => {
  const DRAFT: IntegrationDraft = {
    id: brandId<IntegrationDraftId>({ value: 'draft-1' }),
    workspaceId: workspaceIdOf({ value: WORKSPACE }),
    sessionId: SESSION,
    provider: 'slack',
    verb: 'reply',
    target: { channelId: 'C-harborline', threadTs: '1700000000.000100' },
    body: 'Shipping the fix to payments-api today.',
    status: 'pending',
    createdAt: AT,
    updatedAt: AT,
    decidedAt: null,
  };

  const posts: Array<unknown> = [];

  const stubSlack = ({ isRefusing }: { readonly isRefusing: boolean }) => {
    stubStoryInvoke({
      slack_post_reply: (args: unknown) => {
        if (isRefusing) {
          throw new Error('not_in_channel');
        }
        posts.push(args);
        return { ts: '1', text: '' };
      },
      slack_get_thread: [],
      slack_list_thread_heads: [],
    });
  };

  const seedDraft = () => {
    seed();
    useAppStore.setState({ sessionSlackDrafts: { [SESSION]: [DRAFT] } });
    posts.length = 0;
    stubSlack({ isRefusing: false });
  };

  const fields = { draftId: 'draft-1', seenVersion: slackDraftVersionOf({ draft: DRAFT }) };

  it('posts the reply to the draft thread before it reports done', async () => {
    seedDraft();
    const decide = vi.fn(async () => undefined);
    useAppStore.setState({ decideSessionSlackDraft: decide });
    const outcome = await act({
      kind: 'answerSlackReply',
      fields: { ...fields, verdict: 'send', text: 'Edited reply' },
    });
    expect(outcome.result).toBe('done');
    expect(posts).toEqual([
      expect.objectContaining({
        workspaceId: WORKSPACE,
        channelId: 'C-harborline',
        threadTs: '1700000000.000100',
      }),
    ]);
    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', body: 'Edited reply' }),
    );
  });

  it('fails when Slack refuses and posts nothing twice when only the record failed', async () => {
    seedDraft();
    stubSlack({ isRefusing: true });
    const failed = await act({
      kind: 'answerSlackReply',
      fields: { ...fields, verdict: 'send', text: DRAFT.body },
    });
    expect(failed.result).toBe('failed');
    seedDraft();
    const decide = vi
      .fn<(params: unknown) => Promise<void>>()
      .mockRejectedValueOnce(new Error('disk'))
      .mockResolvedValue(undefined);
    useAppStore.setState({ decideSessionSlackDraft: decide });
    const sendFields = { ...fields, verdict: 'send', text: DRAFT.body };
    expect((await act({ kind: 'answerSlackReply', fields: sendFields })).result).toBe('failed');
    expect((await act({ kind: 'answerSlackReply', fields: sendFields })).result).toBe('done');
    expect(posts).toHaveLength(1);
  });

  it('discards without posting', async () => {
    seedDraft();
    useAppStore.setState({ decideSessionSlackDraft: vi.fn(async () => undefined) });
    const outcome = await act({
      kind: 'answerSlackReply',
      fields: { ...fields, verdict: 'discard', text: '' },
    });
    expect(outcome.result).toBe('done');
    expect(posts).toHaveLength(0);
  });
});

describe('delivery that failed after the decision was saved', () => {
  it('redelivers a saved answer instead of reporting already decided', async () => {
    seed();
    const pending = {
      attemptId: 'attempt-1',
      pairs: [
        {
          id: brandId<OpenQuestionId>({ value: 'question-1' }),
          text: 'Which currency?',
          answer: 'EUR',
        },
      ],
      askingAgentIds: [AGENT],
      error: 'agent unreachable',
    };
    const retry = vi.fn(async ({ sessionId }: { sessionId: string }) => {
      useAppStore.setState({
        pendingOpenQuestionDeliveries: { [sessionId]: undefined },
      });
    });
    useAppStore.setState({
      sessionOpenQuestions: { [SESSION]: [] },
      sessionAnsweredQuestions: { [SESSION]: [questionOf({ value: 'question-1' })] },
      pendingOpenQuestionDeliveries: { [SESSION]: pending },
      retryOpenQuestionDelivery: retry,
    });
    const fields = { questionId: 'question-1', seenVersion: AT, text: 'EUR' };
    const outcome = await act({ kind: 'answerQuestion', fields });
    expect(outcome.result).toBe('done');
    expect(retry).toHaveBeenCalledWith({ sessionId: SESSION, attemptId: 'attempt-1' });
  });

  it('keeps failing while the agent stays unreachable', async () => {
    seed();
    useAppStore.setState({
      sessionOpenQuestions: { [SESSION]: [] },
      pendingOpenQuestionDeliveries: {
        [SESSION]: {
          attemptId: 'attempt-2',
          pairs: [
            {
              id: brandId<OpenQuestionId>({ value: 'question-2' }),
              text: 'Which region?',
              answer: 'EU',
            },
          ],
          askingAgentIds: [AGENT],
          error: 'agent unreachable',
        },
      },
      retryOpenQuestionDelivery: vi.fn(async () => undefined),
    });
    const outcome = await act({
      kind: 'answerQuestion',
      fields: { questionId: 'question-2', seenVersion: AT, text: 'EU' },
    });
    expect(outcome.result).toBe('failed');
  });

  it('resumes the agent for a saved permission without recording the decision twice', async () => {
    seed();
    const input = { command: 'rm -rf node_modules' };
    useAppStore.setState({
      sessionPhaseRuns: {
        [SESSION]: [anAgent({ id: AGENT, sessionId: SESSION, status: 'running' })],
      },
      agentTurnState: { [AGENT]: { kind: 'blocked', runId: PROVIDER_RUN, blockedAt: AT } },
      transcripts: {
        [AGENT]: [
          {
            kind: 'permission_request',
            runId: PROVIDER_RUN,
            toolUseId: 'tool-use-1',
            toolName: 'Bash',
            input,
            at: AT,
          },
        ],
      },
    });
    const sendTurn = vi
      .fn()
      .mockResolvedValueOnce({ blockedOverBudget: true })
      .mockResolvedValue({ blockedOverBudget: false });
    useAppStore.setState({ sendTurn });
    const fields = {
      agentId: AGENT,
      requestId: 'tool-use-1',
      seenInputHash: permissionHashOf({ toolName: 'Bash', input }),
      verdict: 'allow',
    };
    expect((await act({ kind: 'answerPermission', fields })).result).toBe('failed');
    useAppStore.setState({ agentTurnState: { [AGENT]: { kind: 'idle', lastActivityAt: AT } } });
    expect((await act({ kind: 'answerPermission', fields })).result).toBe('done');
    expect(sendTurn).toHaveBeenCalledTimes(2);
    const decisions = (useAppStore.getState().transcripts[AGENT] ?? []).filter(
      (event) => event.kind === 'permission_decision',
    );
    expect(decisions).toHaveLength(1);
  });
});

describe('transcript text', () => {
  it('keeps absolute paths away from user and assistant words', () => {
    const entries = transcriptEntriesOf({
      events: [
        {
          kind: 'user_text',
          runId: PROVIDER_RUN,
          text: 'Look at /Users/amin/work/ledger-core/src/index.ts',
          at: AT,
        },
        {
          kind: 'assistant_text',
          runId: PROVIDER_RUN,
          delta: 'Opened /home/amin/payments-api/a.ts. ',
          at: AT,
        },
        {
          kind: 'assistant_text',
          runId: PROVIDER_RUN,
          delta: 'Yes/no and notify-relay/src stay.',
          at: AT,
        },
      ],
    });
    const text = entries.map((entry) => (entry.kind === 'words' ? entry.text : '')).join('|');
    expect(text).not.toContain('/Users');
    expect(text).not.toContain('/home');
    expect(text).toContain('.../index.ts');
    expect(text).toContain('Yes/no and notify-relay/src stay.');
  });
});

describe('transcript pages', () => {
  it('pages over the whole history, not the tail a cold load returned', async () => {
    seed();
    const events = Array.from({ length: 120 }, (_, index) => ({
      id: `event-${index}`,
      event: {
        kind: 'user_text' as const,
        runId: PROVIDER_RUN,
        text: `message ${index}`,
        at: AT,
      },
    }));
    vi.mocked(listTurnEventEntriesForAgent).mockResolvedValue(events);
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION]: [anAgent({ id: AGENT, sessionId: SESSION })] },
      transcripts: { [AGENT]: events.slice(-50).map((entry) => entry.event) },
    });
    const page = await transcriptOf({
      query: {
        workspaceId: WORKSPACE,
        sessionId: SESSION,
        agentId: AGENT,
        limit: 10,
        beforeEntryId: null,
      },
      getStore: () => useAppStore.getState(),
    });
    expect(page?.entries.map((entry) => entry.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `e${110 + index}`),
    );
    expect(page?.hasEarlier).toBe(true);
  });
});

describe('plan approval delivery', () => {
  const PLAN = brandId<ArtifactId>({ value: 'plan-1' });
  const approve = () =>
    decidePorts.approvePlan({
      sessionId: SESSION,
      rootAgentId: LEAD,
      artifactId: PLAN,
      expectedRevision: 3,
    });

  it('reports a refused Lead message as not delivered', async () => {
    seed();
    const sendTurn = vi.fn(async () => ({ blockedOverBudget: true }));
    useAppStore.setState({ sendTurn, loadAutoTrees: vi.fn(async () => undefined) });
    expect((await approve()).kind).toBe('told_failed');
    expect(sendTurn).toHaveBeenCalledTimes(1);
  });

  it('still tells the Lead when the reload after the write fails', async () => {
    seed();
    const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
    useAppStore.setState({
      sendTurn,
      loadAutoTrees: vi.fn(async () => {
        throw new Error('reload failed');
      }),
    });
    expect((await approve()).kind).toBe('approved');
    expect(sendTurn).toHaveBeenCalledTimes(1);
  });
});

describe('a message to an agent', () => {
  it('reports a refused turn as failed and keeps the same id for the retry', async () => {
    seed();
    const sendTurn = vi
      .fn()
      .mockResolvedValueOnce({ blockedOverBudget: false, isTurnRunning: true })
      .mockResolvedValue({ blockedOverBudget: false });
    useAppStore.setState({ sendTurn });
    const fields = { agentId: AGENT, seenVersion: '0', text: 'Use the retry window' };
    const first = await act({ kind: 'sendToAgent', fields });
    expect(first.result).toBe('failed');
    const retry = await act({ kind: 'sendToAgent', fields });
    expect({ result: retry.result, isReplay: retry.isReplay }).toEqual({
      result: 'done',
      isReplay: false,
    });
    expect(sendTurn).toHaveBeenCalledTimes(2);
  });
});
