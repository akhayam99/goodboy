// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import {
  EMPTY_DURATION_HISTORY,
  PROVIDER_CAPABILITIES,
  type DurationHistory,
  type DurationSample,
} from '@goodboy/core';
import type {
  Agent,
  ProviderId,
  ProviderPolicy,
  SessionId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { TEST_NOW, aSession, aWorkflowRun, aWorkspace, anAgent } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../providers/providers';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { selectRoutingScope } from '../../store/slices/agents/selectRoutingScope';
import { agentReferenceRouting } from '../../store/slices/turn/agentReferenceRouting';
import { useRoutingScope } from '../../shared/hooks/useRoutingScope';
import { agentRowRouting } from '../session/timeline/agentRowRouting';
import { runTimeLeft } from '../session/timeline/runTimeLeft';
import { stepWorkEstimate } from '../session/timeline/stepWorkEstimate';
import type { WorkTimeSource } from '../workTreeModel/workTimeSource';
import { WorkflowNextStepCta } from './components/WorkflowNextStepCta';

const WORKSPACE = aWorkspace({ id: 'workspace-harborline' as WorkspaceId, name: 'Harborline' });
const SESSION = aSession({
  id: 'session-payout-notice' as SessionId,
  workspaceId: WORKSPACE.id,
  goal: 'Draft the payout delay notice',
});
const STEP_ID = 'step-implement' as StepId;
const WORKFLOW_ID = 'workflow-ship' as WorkflowId;
const MINUTE = 60_000;
const NOW = Date.parse('2026-10-01T12:00:00.000Z');

const ANTHROPIC_OFF: ProviderPolicy = [
  { id: 'codex', state: 'on' },
  { id: 'anthropic', state: 'off' },
];

const providerInfo = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const STEP = {
  id: STEP_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  name: 'Write the notice',
  promptPrefix: '',
  role: 'implementer',
} as Step;

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE.id,
  name: 'Ship it',
  description: '',
  steps: [STEP],
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

const PENDING: Agent = anAgent({
  sessionId: SESSION.id,
  stepId: STEP_ID,
  status: 'pending',
  kind: 'implementer',
});

const sample = ({
  provider,
  minutes,
}: {
  readonly provider: ProviderId;
  readonly minutes: number;
}): DurationSample => ({
  role: 'implementer',
  provider,
  model: `${provider}-history`,
  effort: null,
  activeMs: minutes * MINUTE,
  costUsd: null,
  endedAtMs: NOW - MINUTE,
});

const HISTORY: DurationHistory = {
  ...EMPTY_DURATION_HISTORY,
  steps: [
    ...Array.from({ length: 8 }, () => sample({ provider: 'anthropic', minutes: 60 })),
    ...Array.from({ length: 8 }, () => sample({ provider: 'codex', minutes: 6 })),
  ],
};

const SOURCE: WorkTimeSource = {
  nowMs: NOW,
  spans: [],
  history: HISTORY,
  liveStartMs: new Map(),
  childrenOf: new Map(),
};

const modelIdsOf = ({ provider }: { readonly provider: ProviderId }): ReadonlyArray<string> =>
  PROVIDER_CAPABILITIES[provider].models.map((model) => model.id);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const seed = ({ policy }: { readonly policy: ProviderPolicy }) =>
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    providers: [providerInfo({ id: 'anthropic' }), providerInfo({ id: 'codex' })],
    workspaceOverrides: { [WORKSPACE.id]: { ...WORKSPACE.overrides, providerPool: policy } },
  });

beforeEach(async () => {
  await resetStoryStore();
  seed({ policy: ANTHROPIC_OFF });
});

afterEach(() => {
  cleanup();
});

const scope = () => selectRoutingScope({ state: useAppStore.getState(), sessionId: SESSION.id });

describe('a provider set to Off', () => {
  it('is never planned on an agent row, even when the session defaults to it', () => {
    const routing = agentRowRouting({
      executed: null,
      step: STEP,
      kind: 'implementer',
      roleModels: null,
      providerOverride: null,
      modelOverride: null,
      effortOverride: null,
      sessionProvider: 'anthropic',
      sessionEffort: null,
      scope: scope(),
    });

    expect(routing.provider).toBe('codex');
    expect(modelIdsOf({ provider: 'codex' })).toContain(routing.model);
  });

  it('is planned again once the workspace turns it back On', () => {
    seed({
      policy: [
        { id: 'anthropic', state: 'on' },
        { id: 'codex', state: 'on' },
      ],
    });

    const routing = agentRowRouting({
      executed: null,
      step: STEP,
      kind: 'implementer',
      roleModels: null,
      providerOverride: null,
      modelOverride: null,
      effortOverride: null,
      sessionProvider: 'anthropic',
      sessionEffort: null,
      scope: scope(),
    });

    expect(routing.provider).toBe('anthropic');
  });

  it('is never the reference a turn on the step agent starts from', () => {
    const reference = agentReferenceRouting({
      agent: PENDING,
      stepConfig: STEP,
      roleModels: null,
      session: SESSION,
      scope: scope(),
    });

    expect(reference.provider).toBe('codex');
    expect(modelIdsOf({ provider: 'anthropic' })).not.toContain(reference.model);
  });

  it('never feeds the step estimate or the run time left', () => {
    const estimate = stepWorkEstimate({
      step: STEP,
      agent: null,
      kind: null,
      source: SOURCE,
      roleModels: null,
      sessionProvider: 'anthropic',
      sessionEffort: null,
      scope: scope(),
    });
    const left = runTimeLeft({
      run: aWorkflowRun({ executionMode: 'static' }),
      steps: [STEP],
      agents: [],
      source: SOURCE,
      roleModels: null,
      sessionProvider: 'anthropic',
      sessionEffort: null,
      scope: scope(),
    });

    expect(estimate?.midMs).toBe(6 * MINUTE);
    expect(left?.label).toBe('usually 6m');
  });

  it('is never offered by the next step button', async () => {
    const onAdvance = vi.fn();
    render(
      <WorkflowNextStepCta
        workflow={WORKFLOW}
        runs={[PENDING]}
        onAdvance={onAdvance}
        sessionProvider="anthropic"
      />,
    );

    const button = screen.getByTestId('workflow-next-step-cta');
    fireEvent.click(button);

    await waitFor(() => expect(onAdvance).toHaveBeenCalledTimes(1));
    const model = (onAdvance.mock.calls[0]?.[0] as { readonly model: string }).model;
    expect(modelIdsOf({ provider: 'codex' })).toContain(model);
  });

  it('reads the same scope from the hook a row renders with', () => {
    const { result } = renderHook(() => useRoutingScope({ sessionId: SESSION.id }));

    expect(result.current?.policy).toEqual(ANTHROPIC_OFF);
    expect(result.current?.defaultProvider).toBe(scope()?.defaultProvider);
  });
});
