import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  ParallelGroupId,
  ProviderId,
  ProviderRunId,
  Session,
  SessionId,
  Step,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import type { ParallelBranchEffects, ParallelBranchInputs } from '../../parallel-turn';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  runParallelBranch: vi.fn(),
  insertMessage: vi.fn(async () => undefined),
  updateSessionState: vi.fn(async () => undefined),
  invokeAgentList: vi.fn(async () => []),
  flushTurnEvents: vi.fn(),
  beginTurnFileVersionCapture: vi.fn(async () => null),
  finalizeTurnFileVersionCapture: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@goodboy/db', () => ({
  insertMessage: h.insertMessage,
  updateSessionState: h.updateSessionState,
}));

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('../../parallel-turn', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../parallel-turn')>();
  return { ...actual, runParallelBranch: h.runParallelBranch };
});

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.invokeAgentList,
}));

vi.mock('../transcripts/buffer', () => ({ flushTurnEvents: h.flushTurnEvents }));

vi.mock('../file-versions/captureTurnFileVersions', () => ({
  beginTurnFileVersionCapture: h.beginTurnFileVersionCapture,
  finalizeTurnFileVersionCapture: h.finalizeTurnFileVersionCapture,
}));

import { dispatchParallelTurn } from './dispatchParallelTurn';
import { degradedNotifiedAgents } from '../../../shared/utils/degradedNotifiedAgents';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const AGENT_ID = 'agent-1' as AgentId;
const TEMPLATE_ID = 'tpl-1' as WorkflowId;
const NOW = '2026-08-08T00:00:00.000Z' as IsoDateTime;

const makeStep = (id: string, ordinal: number): Step =>
  ({
    id: id as Step['id'],
    workflowId: TEMPLATE_ID,
    ordinal,
    name: id,
    promptPrefix: `[${id}]`,
    parallelGroup: 1,
  }) as Step;

const session: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'ship it',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: true,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const template: Workflow = {
  id: TEMPLATE_ID,
  workspaceId: WORKSPACE_ID,
  name: 'tpl',
  origin: 'custom',
  steps: [makeStep('d-a', 1), makeStep('d-b', 2)],
} as unknown as Workflow;

type Harness = {
  readonly state: Record<string, unknown>;
  readonly set: SetFn;
  readonly get: GetFn;
};

const buildHarness = (): Harness => {
  const state: Record<string, unknown> = {
    sessions: [session],
    workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
    sessionBudgets: {},
    sessionTelemetry: {},
    sessionSummary: null,
    sessionBranches: { [SESSION_ID]: 'ak/workflow' },
    sessionFileVersions: {},
    authResults: {},
    appendTurnEvent: vi.fn(),
    emitNotification: vi.fn(),
    setSessionMergeConflicts: vi.fn(),
  };
  const set = ((update: unknown) => {
    const patch =
      typeof update === 'function'
        ? (update as (s: Record<string, unknown>) => Record<string, unknown>)(state)
        : (update as Record<string, unknown>);
    Object.assign(state, patch);
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, set, get };
};

describe('dispatchParallelTurn notifyDegradedStepSummary effect', () => {
  beforeEach(() => {
    degradedNotifiedAgents.clear();
    h.runParallelBranch.mockReset();
    h.insertMessage.mockClear();
    h.updateSessionState.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const runDispatch = async (harness: Harness): Promise<ParallelBranchEffects> => {
    let capturedEffects: ParallelBranchEffects | null = null;
    h.runParallelBranch.mockImplementation(
      async (_inputs: ParallelBranchInputs, deps: { effects: ParallelBranchEffects }) => {
        capturedEffects = deps.effects;
        return {
          groupId: 'group-1' as ParallelGroupId,
          merge: { runStatuses: [] },
          runIds: [] as ReadonlyArray<ProviderRunId>,
          anyFailed: false,
          allFailed: false,
        };
      },
    );

    await dispatchParallelTurn(harness.set, harness.get, {
      session,
      sessionId: SESSION_ID,
      activeAgentId: AGENT_ID,
      provider: 'anthropic' as ProviderId,
      model: 'claude-sonnet-4-6',
      effort: undefined,
      cursorMaxMode: undefined,
      parallelDispatch: {
        template,
        currentDef: template.steps[0]!,
        groupDefs: template.steps,
      },
      claudeFlags: {},
      apiKeyBinding: undefined,
      providerBinary: undefined,
      workingDir: '/tmp/wt',
      userTurnText: 'go',
      userPromptForPhase: 'go',
      phasePromptCarryForward: '',
      phaseWorkflowRunId: null,
      now: () => NOW,
    });

    if (capturedEffects == null) {
      throw new Error('runParallelBranch was not called');
    }
    return capturedEffects;
  };

  it('emits a summarizer-degraded notification for a branch reported as degraded', async () => {
    const harness = buildHarness();
    const effects = await runDispatch(harness);

    effects.notifyDegradedStepSummary({
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
      agentName: 'd-b',
    });

    expect(harness.state.emitNotification).toHaveBeenCalledWith(
      'summarizer-degraded',
      'warning',
      expect.stringContaining('d-b'),
      expect.any(String),
      {
        sessionId: SESSION_ID,
        action: { kind: 'retry-step-summary', sessionId: SESSION_ID, agentId: AGENT_ID },
      },
    );
  });

  it('suppresses a second notification for the same agent (dedupe)', async () => {
    const harness = buildHarness();
    const effects = await runDispatch(harness);

    effects.notifyDegradedStepSummary({
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
      agentName: 'd-b',
    });
    effects.notifyDegradedStepSummary({
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
      agentName: 'd-b',
    });

    expect(harness.state.emitNotification).toHaveBeenCalledTimes(1);
  });
});
