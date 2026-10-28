// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OrchestratorRouting, ProviderId, WorkflowRun } from '@goodboy/types';
import { aSession, aWorkflowRun, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import type { ProviderDisplayInfo } from '../../../../providers/providers';
import { OrchestratorModelChip } from './index';

const WORKSPACE = aWorkspace({ name: 'Cascadia' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Refund retries' });

type StoryState = ReturnType<StoryStore['getState']>;
type SetRouting = StoryState['setWorkflowOrchestratorRouting'];

let useAppStore: StoryStore;

const providerOf = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
  id,
  label: id,
  error: null,
  docsUrl: 'https://example.com/docs',
  binary: id,
  capabilities: { models: [] },
  connection: 'connected',
  version: null,
  identity: null,
});

type RunParams = {
  readonly routing?: OrchestratorRouting;
};

const runOf = ({ routing }: RunParams = {}): WorkflowRun =>
  aWorkflowRun({
    executionMode: 'dynamic',
    ...(routing !== undefined && { orchestratorRouting: routing }),
  });

type ShowParams = {
  readonly run: WorkflowRun;
  readonly isOpen?: boolean;
};

const show = ({ run, isOpen = true }: ShowParams) => {
  const session = { ...SESSION, workflowRuns: [run] };
  useAppStore.setState({ sessions: [session] });
  render(
    <ToastProvider>
      <OrchestratorModelChip session={session} run={run} isOpen={isOpen} />
    </ToastProvider>,
  );
};

const chip = () => screen.getByRole('button', { name: /^Orchestrator:/ });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    workspaceOverrides: {},
    providers: [providerOf({ id: 'anthropic' }), providerOf({ id: 'cursor' })],
  });
});

afterEach(cleanup);

describe('OrchestratorModelChip', () => {
  it('names the orchestrator model of the run, Auto while the run pins none', () => {
    show({ run: runOf() });

    expect(chip().getAttribute('data-run-model')).toBe('auto');
    expect(chip().getAttribute('aria-label')).toMatch(/, Auto$/);
  });

  it('names the model pinned for this run', () => {
    show({
      run: runOf({
        routing: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
      }),
    });

    expect(chip().getAttribute('data-run-model')).toBe('pinned');
    expect(chip().textContent).toContain('Opus');
  });

  it('writes the model picked to the per run override', () => {
    const setRouting = vi.fn<SetRouting>(async () => undefined);
    useAppStore.setState({ setWorkflowOrchestratorRouting: setRouting });
    const run = runOf();
    show({ run });

    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));

    expect(setRouting).toHaveBeenCalledTimes(1);
    expect(setRouting).toHaveBeenCalledWith(
      SESSION.id,
      run.id,
      expect.objectContaining({ providerId: 'cursor' }),
    );
  });

  it('goes back to the default with the Auto row', () => {
    const setRouting = vi.fn<SetRouting>(async () => undefined);
    useAppStore.setState({ setWorkflowOrchestratorRouting: setRouting });
    const run = runOf({
      routing: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
    });
    show({ run });

    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('button', { name: /^Auto, now / }));

    expect(setRouting).toHaveBeenCalledWith(SESSION.id, run.id, null);
  });

  it('stays readable and fixed once the run is over', () => {
    show({ run: runOf(), isOpen: false });

    expect(chip().hasAttribute('disabled')).toBe(true);
  });

  it('is fixed while the orchestrator is deciding', () => {
    const run = runOf();
    useAppStore.setState({ orchestratingWorkflowRuns: { [run.id]: true } });
    show({ run });

    expect(chip().hasAttribute('disabled')).toBe(true);
  });

  it('shows a failure of the write instead of dropping it', async () => {
    const reportError = vi.fn<StoryState['reportError']>(async () => undefined);
    useAppStore.setState({
      setWorkflowOrchestratorRouting: vi.fn<SetRouting>(async () => {
        throw new Error('The run could not be saved');
      }),
      reportError,
    });
    show({ run: runOf() });

    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));

    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(reportError.mock.calls[0]?.[0]).toMatchObject({
      title: "Couldn't change the orchestrator model",
    });
  });
});
