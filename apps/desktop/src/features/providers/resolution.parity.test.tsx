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
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_GROUPS, TASKS } from '@goodboy/core';
import type {
  AuxTaskId,
  OverrideSettings,
  ProviderConnectionState,
  ProviderId,
  ProviderPolicy,
  WorkflowRun,
} from '@goodboy/types';
import { aProject, aSession, aWorkflowRun, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { ToastProvider } from '../../shared/components/Toast';
import { selectResolution } from '../../store/slices/models/selectResolution';
import { OrchestratorRoutingRow } from '../workflows/components/OrchestratorStrip/OrchestratorRoutingRow';
import { WorkflowBuilderView } from '../workflows/components/WorkflowBuilderView';
import { ROLE_LABEL } from '../session/agent-kind';
import { DefaultsPanel } from './components/ProviderStudio/DefaultsPanel';
import { modelNameOf } from './components/ProviderStudio/DefaultsPanel/modelNameOf';
import type { ProviderDisplayInfo } from './providers';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

const SESSION = aSession({
  workspaceId: WORKSPACE.id,
  providerPreference: { defaultProvider: 'codex', allowTurnOverride: false },
});

const RUN: WorkflowRun = aWorkflowRun({ executionMode: 'dynamic' });

const CODEX_ONLY: ProviderPolicy = [
  { id: 'codex', state: 'on' },
  { id: 'anthropic', state: 'off' },
];

const ANTHROPIC_ON: ProviderPolicy = [
  { id: 'anthropic', state: 'on' },
  { id: 'codex', state: 'on' },
];

const providerInfo = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection: 'connected' satisfies ProviderConnectionState,
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const LEGACY_PROJECT_OVERRIDE: OverrideSettings = {
  ...WORKSPACE.overrides,
  taskModels: { summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' } },
  roleModels: { scribe: { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' } },
};

type SeedParams = {
  readonly policy: ProviderPolicy;
};

let useAppStore: StoryStore;

const seed = ({ policy }: SeedParams) => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    providers: [providerInfo({ id: 'anthropic' }), providerInfo({ id: 'codex' })],
    projects: [
      aProject({
        workspaceId: WORKSPACE.id,
        name: 'payments-api',
        overrides: LEGACY_PROJECT_OVERRIDE,
      }),
    ],
    workspaceOverrides: {
      [WORKSPACE.id]: {
        ...WORKSPACE.overrides,
        defaultProviderId: policy[0]?.id ?? 'anthropic',
        providerPool: policy,
        roleModels: {
          planner: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
          reviewer: { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
        },
        taskModels: {
          workflow_orchestrator: { providerId: 'anthropic', model: 'claude-sonnet-5-5' },
          plan_generation: { providerId: 'anthropic', model: 'claude-opus-5-5' },
        },
      },
    },
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const nameOf = ({ task }: { readonly task: AuxTaskId }): string => {
  const resolution = selectResolution({
    state: useAppStore.getState(),
    sessionId: SESSION.id,
    slot: { kind: 'task', id: task },
  });
  return modelNameOf({ provider: resolution.provider, model: resolution.model });
};

const taskRow = ({ task }: { readonly task: string }): string => {
  const label = document.querySelector<HTMLElement>(`[data-default-row="${task}"]`);
  const row = label?.parentElement;
  if (row == null) {
    throw new Error(`no row for ${task}`);
  }
  const names = Array.from(row.querySelectorAll('[aria-label]')).map(
    (element) => element.getAttribute('aria-label') ?? '',
  );
  return [row.textContent ?? '', ...names].join(' ');
};

describe.each([
  ['Codex only, pins on Anthropic', CODEX_ONLY],
  ['Anthropic on, pins run', ANTHROPIC_ON],
] as const)('one resolution: %s', (_name, policy) => {
  it('prints the same orchestrator model on the Models page, the run pill and the builder pill', () => {
    seed({ policy });
    const expected = nameOf({ task: 'workflow_orchestrator' });

    render(<OrchestratorRoutingRow sessionId={SESSION.id} run={RUN} disabled={false} />);
    const pill = screen.getByRole('button', { name: /^Orchestrator routing:/ });
    expect(pill.getAttribute('aria-label')).toContain(expected);
    cleanup();

    render(<DefaultsPanel workspaceId={WORKSPACE.id} />);
    expect(taskRow({ task: 'workflow_orchestrator' })).toContain(expected);
    cleanup();

    render(
      <ToastProvider>
        <WorkflowBuilderView session={SESSION} onClose={vi.fn()} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /orchestrated/i }));
    const builder = screen.getByRole('button', { name: /^Orchestrator routing:/ });
    expect(builder.getAttribute('aria-label')).toContain(expected);
  });

  it('prints the resolved model on every role row and task row of the Models page', () => {
    seed({ policy });
    render(<DefaultsPanel workspaceId={WORKSPACE.id} />);

    for (const role of DEFAULT_GROUPS.agents.flatMap((group) => group.members)) {
      const resolution = selectResolution({
        state: useAppStore.getState(),
        workspaceId: WORKSPACE.id,
        slot: { kind: 'role', id: role },
      });
      const expected = modelNameOf({ provider: resolution.provider, model: resolution.model });
      const trigger = screen.getByRole('button', {
        name: (name) => name.startsWith(ROLE_LABEL[role]),
      });
      expect(
        trigger.querySelector<HTMLElement>('[data-role-summary]')?.textContent ?? '',
        role,
      ).toContain(expected);
    }
    for (const task of TASKS) {
      const resolution = selectResolution({
        state: useAppStore.getState(),
        workspaceId: WORKSPACE.id,
        slot: { kind: 'task', id: task.id },
      });
      const expected = modelNameOf({ provider: resolution.provider, model: resolution.model });
      expect(taskRow({ task: task.id }), task.id).toContain(expected);
    }
  });
});
