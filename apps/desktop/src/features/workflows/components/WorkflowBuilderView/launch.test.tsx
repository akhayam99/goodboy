// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId, Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  emptyOverrides,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { writeLastWorkflowMode } from './lastWorkflowMode';
import { WorkflowBuilderView } from './index';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const session = buildStorySession({
  id: 'session-harborline' as SessionId,
  workspaceId: WORKSPACE_ID,
  goal: 'Retry payments through ledger-core',
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
});

const connected = (id: ProviderId): AppStore['providers'][number] => ({
  id,
  binary: id,
  capabilities: PROVIDER_CAPABILITIES[id],
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const PLAN = {
  workflowName: 'Retry payments',
  reasoning: 'two steps cover it',
  steps: [
    { name: 'Map', role: 'scout', promptPrefix: 'Map the retry flow', expectedOutput: 'a map' },
    { name: 'Fix', role: 'implementer', promptPrefix: 'Fix the retries', expectedOutput: 'a fix' },
  ],
};

let useAppStore: StoryStore;
const attachWorkflowToSession = vi.fn<AppStore['attachWorkflowToSession']>();
const savePhaseTemplate = vi.fn<AppStore['savePhaseTemplate']>();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  attachWorkflowToSession.mockReset();
  attachWorkflowToSession.mockResolvedValue(undefined);
  savePhaseTemplate.mockReset();
  useAppStore.setState({
    workspaces: [harborline],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [session],
    providers: [connected('anthropic')],
    phaseTemplates: { [WORKSPACE_ID]: [] },
    attachWorkflowToSession,
    savePhaseTemplate,
  });
  stubStoryInvoke({
    planner_run: {
      stdout: JSON.stringify({ result: JSON.stringify(PLAN) }),
      stderr: '',
      exitCode: 0,
    },
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const plannerRun = () =>
  storySpies.tauriInvoke.mock.calls.find(([command]) => command === 'planner_run')?.[1] as
    { readonly args: Readonly<Record<string, unknown>> } | undefined;

const draftPlan = async () => {
  fireEvent.change(screen.getByPlaceholderText(/what should this workflow accomplish/i), {
    target: { value: 'Retry payments through ledger-core' },
  });
  fireEvent.change(screen.getByPlaceholderText(/describe the process/i), {
    target: { value: 'map the flow, then fix it' },
  });
  fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));
  await waitFor(() => expect(plannerRun()).toBeDefined());
};

describe('WorkflowBuilderView on the real store: planner routing', () => {
  it('sends the plan to the resolved Auto model when nothing is pinned', async () => {
    writeLastWorkflowMode({ workspaceId: WORKSPACE_ID, mode: 'custom' });
    render(
      <ToastProvider>
        <WorkflowBuilderView session={session} onClose={vi.fn()} />
      </ToastProvider>,
    );

    await draftPlan();

    expect(plannerRun()?.args).toMatchObject({
      providerId: 'anthropic',
      model: 'claude-sonnet-5-5',
    });
  });

  it('sends the plan to the plan_generation model and effort the workspace configured', async () => {
    writeLastWorkflowMode({ workspaceId: WORKSPACE_ID, mode: 'custom' });
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE_ID]: {
          ...emptyOverrides,
          taskModels: {
            plan_generation: {
              providerId: 'anthropic',
              model: 'claude-sonnet-5',
              effort: 'medium',
            },
          },
        },
      },
    });
    render(
      <ToastProvider>
        <WorkflowBuilderView session={session} onClose={vi.fn()} />
      </ToastProvider>,
    );

    await draftPlan();

    expect(plannerRun()?.args).toMatchObject({
      providerId: 'anthropic',
      model: 'claude-sonnet-5',
      effort: 'medium',
    });
  });
});

type KickoffProps = {
  readonly target: Session;
};

const Kickoff = ({ target }: KickoffProps) => {
  const [goal, setGoal] = useState('');
  return (
    <ToastProvider>
      <WorkflowBuilderView
        kickoff={{
          workspaceId: WORKSPACE_ID,
          goal,
          goalPlaceholder: 'What should get done?',
          onGoalChange: setGoal,
          start: async (run) => run(target),
        }}
      />
    </ToastProvider>
  );
};

describe('WorkflowBuilderView on the real store: when to ask', () => {
  it('asks before each step by default and starts the run on its own when you choose it', async () => {
    render(<Kickoff target={session} />);
    fireEvent.change(screen.getByPlaceholderText('What should get done?'), {
      target: { value: 'Retry payments through ledger-core' },
    });

    screen.getByRole('button', { name: 'When to ask: Ask before each step' });
    expect(screen.queryByRole('switch', { name: 'Autorun' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'When to ask: Ask before each step' }));
    fireEvent.click(screen.getByRole('radio', { name: /^Run on its own/ }));
    fireEvent.click(screen.getByRole('button', { name: /start run/i }));

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      autoRun: true,
      executionMode: 'dynamic',
    });
  });
});
