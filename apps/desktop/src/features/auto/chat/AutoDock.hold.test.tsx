// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../session/startRun/switchHeldRun', () => ({ switchHeldRun: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { aSession, aWorkspace, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { AutoHold, AutoTreeView } from '../../../store/slices/auto-view/state';
import { OldRunLeftError } from '../../session/startRun/OldRunLeftError';
import { switchHeldRun } from '../../session/startRun/switchHeldRun';
import { registerAutoUserTurnPort, type AutoUserTurnPort } from '../autoUserTurnPort';
import { registerTreeStopPort, type TreeStopPort } from '../treeStopPort';
import { AutoDockUnderTest } from '../testing/AutoDockUnderTest';
import { FIXTURE_SESSION, aPlanRow, aView } from '../testing/autoViewFixtures';

let useAppStore: StoryStore;

type StoryState = ReturnType<StoryStore['getState']>;

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const ROOT = anAgent({ id: brandId<AgentId>({ value: 'agent-auto' }) });

const HOLD: AutoHold = {
  reason: 'Rounding each line matches the settlement spec, so this is not a bug.',
  suggestion: 'Ship a feature',
  suggestionId: 'workflow-feature',
};

const viewOf = (hold: AutoHold | null): AutoTreeView => ({
  ...aView(),
  hold,
  guide: {
    workflowId: 'workflow-bug',
    name: 'Fix a bug',
    check: hold === null ? 'passed' : 'held',
    steps: [{ name: 'Find the cause', role: 'debugger' }],
    deviations: [],
  },
});

const reportError = vi.fn<StoryState['reportError']>(async () => undefined);

const renderDock = (view: AutoTreeView) => {
  useAppStore.setState({
    sessions: [aSession({ id: FIXTURE_SESSION, workspaceId: WORKSPACE.id })],
    autoTreeViews: { [FIXTURE_SESSION]: [view] },
    loadAutoTrees: async () => undefined,
    reportError,
  });
  return render(<AutoDockUnderTest view={view} rootAgent={ROOT} onOpenArtifact={vi.fn()} />);
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  reportError.mockReset();
  vi.mocked(switchHeldRun).mockReset();
});

afterEach(() => {
  cleanup();
  registerAutoUserTurnPort({ port: null });
  registerTreeStopPort({ port: null });
});

describe('AutoDock hold card', () => {
  it('draws the reason with a switch, a continue and a stop', () => {
    renderDock(viewOf(HOLD));

    screen.getByText('Stopped on the first check');
    screen.getByText(HOLD.reason);
    screen.getByRole('button', { name: 'Switch to Ship a feature' });
    screen.getByRole('button', { name: 'Continue with Fix a bug' });
    screen.getByRole('button', { name: 'Stop the run' });
    screen.getByText('Your findings and guidance carry over.');
  });

  it('offers only continue and stop without a suggestion', () => {
    renderDock(viewOf({ reason: HOLD.reason, suggestion: null, suggestionId: null }));

    expect(screen.queryByRole('button', { name: /^Switch to/ })).toBeNull();
    screen.getByRole('button', { name: 'Continue with Fix a bug' });
    screen.getByRole('button', { name: 'Stop the run' });
    expect(screen.queryByText('Your findings and guidance carry over.')).toBeNull();
  });

  it('draws nothing when the run is not held', () => {
    renderDock(viewOf(null));

    expect(document.querySelector('[data-hold-card]')).toBeNull();
  });

  it('hides a waiting plan so the card stands alone', () => {
    const planned = aView({ phase: 'waiting', artifacts: [aPlanRow()] });
    renderDock({ ...viewOf(HOLD), tree: planned.tree, artifacts: planned.artifacts });

    screen.getByRole('button', { name: 'Switch to Ship a feature' });
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
  });

  it('puts focus on the switch when the page lands on the card', () => {
    renderDock(viewOf(HOLD));

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Switch to Ship a feature' }),
    );
  });

  it('puts focus on continue when there is nothing to switch to', () => {
    renderDock(viewOf({ reason: HOLD.reason, suggestion: null, suggestionId: null }));

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Continue with Fix a bug' }),
    );
  });

  it('leaves the focus alone when the owner is typing elsewhere', () => {
    const field = document.createElement('textarea');
    document.body.append(field);
    field.focus();

    renderDock(viewOf(HOLD));

    expect(document.activeElement).toBe(field);
    field.remove();
  });

  it('switches to the suggested workflow once', async () => {
    vi.mocked(switchHeldRun).mockResolvedValue(undefined);
    renderDock(viewOf(HOLD));
    const button = screen.getByRole('button', { name: 'Switch to Ship a feature' });

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(switchHeldRun).toHaveBeenCalledTimes(1));
    expect(switchHeldRun).toHaveBeenCalledWith({
      sessionId: FIXTURE_SESSION,
      agentId: ROOT.id,
      workflowId: 'workflow-feature',
    });
  });

  it('reports a failed switch with a retry that switches again', async () => {
    vi.mocked(switchHeldRun)
      .mockRejectedValueOnce(new Error('No provider is connected'))
      .mockResolvedValueOnce(undefined);
    renderDock(viewOf(HOLD));

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Ship a feature' }));
    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    const retry = reportError.mock.calls[0]?.[0].retry;
    expect(retry).toBeDefined();
    let isRetried = false;
    await act(async () => {
      isRetried = (await retry?.()) ?? false;
    });

    expect(isRetried).toBe(true);
    expect(switchHeldRun).toHaveBeenCalledTimes(2);
  });

  it('reports an old run left running with a retry that only stops it', async () => {
    const endOldRun = vi.fn<() => Promise<void>>(async () => undefined);
    vi.mocked(switchHeldRun).mockRejectedValueOnce(
      new OldRunLeftError({ message: 'left', failure: new Error('stuck'), endOldRun }),
    );
    renderDock(viewOf(HOLD));

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Ship a feature' }));
    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    await act(async () => {
      await reportError.mock.calls[0]?.[0].retry?.();
    });

    expect(endOldRun).toHaveBeenCalledTimes(1);
    expect(switchHeldRun).toHaveBeenCalledTimes(1);
  });

  it('continues by telling the Lead, which lifts the hold', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    renderDock(viewOf(HOLD));

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Fix a bug' }));

    await waitFor(() => expect(port).toHaveBeenCalledTimes(1));
    expect(port.mock.calls[0]?.[0]).toMatchObject({
      agentId: ROOT.id,
      sessionId: FIXTURE_SESSION,
      workspaceId: WORKSPACE.id,
      deliveryId: 'hold-continue:tree-harborline:0',
    });
    expect(port.mock.calls[0]?.[0].text).toContain('Continue with Fix a bug');
  });

  it('keeps the card and reports when the continue is lost, then retries', async () => {
    const port = vi
      .fn<AutoUserTurnPort>()
      .mockResolvedValueOnce('lost')
      .mockResolvedValueOnce('queued');
    registerAutoUserTurnPort({ port });
    renderDock(viewOf(HOLD));

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Fix a bug' }));
    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    screen.getByRole('button', { name: 'Continue with Fix a bug' });
    await act(async () => {
      await reportError.mock.calls[0]?.[0].retry?.();
    });

    expect(port).toHaveBeenCalledTimes(2);
  });

  it('stops the run through the tree stop', async () => {
    const stop = vi.fn<TreeStopPort>(async () => 'stopped');
    registerTreeStopPort({ port: stop });
    const view = viewOf(HOLD);
    renderDock(view);

    fireEvent.click(screen.getByRole('button', { name: 'Stop the run' }));

    await waitFor(() => expect(stop).toHaveBeenCalledWith({ treeId: view.tree.id }));
  });

  it('shows a failed stop and lets the owner press it again', async () => {
    const stop = vi
      .fn<TreeStopPort>()
      .mockResolvedValueOnce('stuck')
      .mockResolvedValueOnce('stopped');
    registerTreeStopPort({ port: stop });
    renderDock(viewOf(HOLD));

    fireEvent.click(screen.getByRole('button', { name: 'Stop the run' }));
    await screen.findByText("Couldn't stop the run");
    fireEvent.click(screen.getByRole('button', { name: 'Stop the run' }));

    await waitFor(() => expect(stop).toHaveBeenCalledTimes(2));
  });
});
