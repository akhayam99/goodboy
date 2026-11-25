// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearActionLedger } from './actionLedger';
import { RATE_WINDOWS, clearRateSlots } from './actionLimits';
import { clearActionRegistry, mintActionId } from './actionRegistry';
import {
  AGENT,
  DRAFT,
  DRAFT_ID,
  DRAFT_VERSION,
  PERMISSION_HASH,
  PLAN,
  QUESTION_ID,
  QUESTION_VERSION,
  RUN,
  SESSION,
  TOOL_USE,
  WORKSPACE,
  buildTestStore,
  type TestStore,
} from './decideTestKit';
import type { DecideKind } from './decideAction';
import { executeDecideAction } from './executeDecideAction';
import { clearLimitUndos } from './limitUndos';
import { parseDecideAction } from './parseDecideAction';
import { registerDecideScope, resetDecideScope } from './phoneScope';

type Fields = Readonly<Record<string, unknown>>;

type Case = {
  readonly kind: DecideKind;
  readonly fields: Fields;
  readonly stale: Fields;
  readonly state?: Record<string, unknown>;
  readonly called: (kit: TestStore) => ReturnType<typeof vi.fn>;
};

const PAUSED_RUN = {
  sessions: [
    {
      id: SESSION,
      workspaceId: WORKSPACE,
      workflowRuns: [{ id: RUN, workflowId: 'wf-1', orchestrationStop: { kind: 'operator' } }],
    },
  ],
};

const STOPPED_AGENT = {
  agentTurnState: {},
  sessionPhaseRuns: { [SESSION]: [{ id: AGENT, status: 'stopped', workflowRunId: RUN }] },
};

const CASES: ReadonlyArray<Case> = [
  {
    kind: 'answerQuestion',
    fields: { questionId: QUESTION_ID, seenVersion: QUESTION_VERSION, text: 'EUR' },
    stale: { seenVersion: 'old' },
    called: (kit) => kit.actions.answerOpenQuestions,
  },
  {
    kind: 'approvePlan',
    fields: { planId: PLAN, seenPlanVersion: 3 },
    stale: { seenPlanVersion: 2 },
    called: (kit) => kit.approvePlan,
  },
  {
    kind: 'requestPlanChanges',
    fields: { planId: PLAN, seenPlanVersion: 3, text: 'Split the migration' },
    stale: { seenPlanVersion: 2 },
    called: (kit) => kit.actions.sendTurn,
  },
  {
    kind: 'answerPermission',
    fields: {
      agentId: AGENT,
      requestId: TOOL_USE,
      seenInputHash: PERMISSION_HASH,
      verdict: 'allow',
    },
    stale: { seenInputHash: 'old' },
    called: (kit) => kit.actions.allowAndContinue,
  },
  {
    kind: 'raiseLimit',
    fields: { runId: RUN, seenLimit: 10, offeredAmount: 15 },
    stale: { seenLimit: 5 },
    called: (kit) => kit.actions.setSessionBudget,
  },
  {
    kind: 'stopRun',
    fields: { runId: RUN, seenState: 'running' },
    stale: { seenState: 'paused' },
    called: (kit) => kit.actions.closeWorkflowRun,
  },
  {
    kind: 'continueRun',
    fields: { runId: RUN, seenState: 'paused' },
    stale: { seenState: 'running' },
    state: PAUSED_RUN,
    called: (kit) => kit.actions.continueWorkflowRun,
  },
  {
    kind: 'stopAgent',
    fields: { agentId: AGENT, seenState: 'waiting' },
    stale: { seenState: 'running' },
    called: (kit) => kit.actions.cancelTurnConfirmed,
  },
  {
    kind: 'continueAgent',
    fields: { agentId: AGENT, seenState: 'stopped' },
    stale: { seenState: 'failed' },
    state: STOPPED_AGENT,
    called: (kit) => kit.actions.continueStoppedAgent,
  },
  {
    kind: 'answerSlackReply',
    fields: { verdict: 'send', draftId: DRAFT_ID, seenVersion: DRAFT_VERSION, text: DRAFT.body },
    stale: { seenVersion: 'old' },
    called: (kit) => kit.actions.decideSessionSlackDraft,
  },
];

type RunParams = {
  readonly kit: TestStore;
  readonly kase: Case;
  readonly overrides?: Fields;
  readonly actionId?: string;
  readonly phoneId?: string | null;
  readonly now?: number;
};

const mintFor = ({ kase }: { readonly kase: Case }): string =>
  mintActionId({ kind: kase.kind, workspaceId: WORKSPACE, sessionId: SESSION });

const run = ({ kit, kase, overrides = {}, actionId, phoneId = 'phone-1', now }: RunParams) => {
  const action = parseDecideAction({
    raw: {
      kind: kase.kind,
      actionId: actionId ?? mintFor({ kase }),
      workspaceId: WORKSPACE,
      sessionId: SESSION,
      ...kase.fields,
      ...overrides,
    },
  });
  if (action === null) {
    throw new Error(`test action ${kase.kind} did not parse`);
  }
  return executeDecideAction({
    action,
    phoneId,
    getStore: () => kit.store,
    ports: kit.ports,
    ...(now === undefined ? {} : { now }),
  });
};

beforeEach(() => {
  clearActionLedger();
  clearActionRegistry();
  clearRateSlots();
  clearLimitUndos();
  resetDecideScope();
});

describe.each(CASES)('$kind', (kase) => {
  it('calls the desktop action and reports done', async () => {
    const kit = buildTestStore({ state: kase.state ?? {} });
    const outcome = await run({ kit, kase });
    expect(outcome.result).toBe('done');
    expect(kase.called(kit)).toHaveBeenCalledTimes(1);
  });

  it('refuses a version the phone did not see and says what changed', async () => {
    const kit = buildTestStore({ state: kase.state ?? {} });
    const outcome = await run({ kit, kase, overrides: kase.stale });
    expect(outcome.refusal?.code).toBe('version-changed');
    expect(outcome.refusal?.changes.length).toBeGreaterThan(0);
    expect(kase.called(kit)).not.toHaveBeenCalled();
  });

  it('replays the first outcome for the same action id', async () => {
    const kit = buildTestStore({ state: kase.state ?? {} });
    const actionId = mintFor({ kase });
    const first = await run({ kit, kase, actionId });
    const second = await run({ kit, kase, actionId });
    expect(first.isReplay).toBe(false);
    expect({ replay: second.isReplay, result: second.result }).toEqual({
      replay: true,
      result: 'done',
    });
    expect(kase.called(kit)).toHaveBeenCalledTimes(1);
  });

  it('stops the request that follows the rate limit', async () => {
    const kit = buildTestStore({ state: kase.state ?? {} });
    const { max } = RATE_WINDOWS[kase.kind];
    for (let index = 0; index < max; index += 1) {
      await run({ kit, kase, now: 1000 });
    }
    const outcome = await run({ kit, kase, now: 1000 });
    expect(outcome.refusal?.code).toBe('rate-limited');
  });

  it('refuses when the phone may not decide and asks the scope for that phone', async () => {
    const kit = buildTestStore({ state: kase.state ?? {} });
    const read = vi.fn(() => false);
    registerDecideScope({ read });
    const outcome = await run({ kit, kase, phoneId: 'phone-7' });
    expect(outcome.refusal?.code).toBe('not-permitted');
    expect(read).toHaveBeenCalledWith({ phoneId: 'phone-7' });
    expect(kase.called(kit)).not.toHaveBeenCalled();
  });

  it('refuses an id the Mac never minted', async () => {
    const kit = buildTestStore({ state: kase.state ?? {} });
    const outcome = await run({ kit, kase, actionId: 'made-up-by-the-phone' });
    expect(outcome.refusal?.code).toBe('unknown-target');
    expect(kase.called(kit)).not.toHaveBeenCalled();
  });
});
