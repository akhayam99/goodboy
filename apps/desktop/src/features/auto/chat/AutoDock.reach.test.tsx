// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

const { approveAutoPlan } = vi.hoisted(() => ({ approveAutoPlan: vi.fn() }));

vi.mock('../plan/approveAutoPlan', () => ({ approveAutoPlan }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AUTO_BLOCK_TEXT } from '@goodboy/core/auto';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { registerTreeStopPort } from '../treeStopPort';
import { aDelegation, aPlanRow, aView, FIXTURE_SESSION } from '../testing/autoViewFixtures';
import { AutoDockUnderTest } from '../testing/AutoDockUnderTest';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  approveAutoPlan.mockReset();
});

afterEach(() => {
  cleanup();
  registerTreeStopPort({ port: null });
});

const ROOT = anAgent({ id: brandId<AgentId>({ value: 'agent-auto' }) });

const renderDock = ({ view }: { readonly view: AutoTreeView }) => {
  useAppStore.setState({ autoTreeViews: { [FIXTURE_SESSION]: [view] } });
  return render(<AutoDockUnderTest view={view} rootAgent={ROOT} onOpenArtifact={vi.fn()} />);
};

const RUNNING = [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })];

describe('the Auto dock Stop outside working', () => {
  it('keeps Stop on the chat when Auto is paused at the limit', async () => {
    const stop = vi.fn(async () => 'stopped' as const);
    registerTreeStopPort({ port: stop });
    const view = aView({ phase: 'waiting', delegations: RUNNING, spentUsd: 10, capUsd: 10 });
    renderDock({ view });

    screen.getByText(/^At the \$10\.00 limit\. No new agent starts\./);
    fireEvent.click(screen.getByRole('button', { name: 'Stop Auto and 1 agent' }));

    await waitFor(() => expect(stop).toHaveBeenCalledWith({ treeId: view.tree.id }));
  });

  it('keeps Stop when the budget blocked Auto', () => {
    const base = aView({ phase: 'blocked', delegations: RUNNING, spentUsd: 10, capUsd: 10 });
    renderDock({
      view: { ...base, tree: { ...base.tree, blockedReason: AUTO_BLOCK_TEXT.budget } },
    });

    screen.getByRole('button', { name: 'Stop Auto and 1 agent' });
    expect(screen.queryByRole('button', { name: 'Change approach' })).toBeNull();
  });

  it('keeps Stop while Auto asks which project to use', () => {
    renderDock({
      view: aView({
        phase: 'waiting',
        pendingRefusal: { action: 'delegate', code: 'mount_missing', roles: ['implementer'] },
      }),
    });

    screen.getByRole('button', { name: 'Stop Auto' });
    screen.getByText('Where should the Implementer work?');
    expect(screen.queryByRole('button', { name: 'Change approach' })).toBeNull();
  });

  it('draws no Stop once Auto is stopped or finished', () => {
    renderDock({ view: aView({ phase: 'stopped' }) });

    expect(screen.queryByRole('button', { name: /^Stop/ })).toBeNull();
  });
});

describe('the Auto dock live region', () => {
  it('announces the working sentence the glance line leaves out', () => {
    renderDock({ view: aView({ phase: 'waiting', delegations: RUNNING }) });

    expect(screen.getByRole('status').textContent).toBe('Implementer running');
  });
});

describe('the Auto dock when Auto was not told', () => {
  it('offers Tell Auto in the dock and sends the approval again', async () => {
    const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
    useAppStore.setState({
      sendTurn,
      reportError: vi.fn(async () => undefined),
      loadAutoTrees: async () => undefined,
    });
    approveAutoPlan.mockResolvedValue({
      kind: 'told_failed',
      revision: 1,
      error: new Error('offline'),
    });
    renderDock({ view: aView({ phase: 'waiting', artifacts: [aPlanRow()] }) });

    fireEvent.click(screen.getByRole('button', { name: 'Approve and start Build' }));
    const tell = await screen.findByRole('button', { name: 'Tell Auto' });
    screen.getByText("Plan v1 approved, Auto didn't hear it");
    expect(screen.queryByRole('button', { name: 'Approve and start Build' })).toBeNull();
    fireEvent.click(tell);

    await waitFor(() =>
      expect(sendTurn).toHaveBeenCalledWith({
        sessionId: FIXTURE_SESSION,
        agentId: ROOT.id,
        content: 'Approved plan v1.',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Tell Auto' })).toBeNull());
  });

  it('keeps Tell Auto when telling fails again', async () => {
    const sendTurn = vi.fn(async () => {
      throw new Error('still offline');
    });
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ sendTurn, reportError, loadAutoTrees: async () => undefined });
    approveAutoPlan.mockResolvedValue({
      kind: 'told_failed',
      revision: 1,
      error: new Error('offline'),
    });
    renderDock({ view: aView({ phase: 'waiting', artifacts: [aPlanRow()] }) });

    fireEvent.click(screen.getByRole('button', { name: 'Approve and start Build' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tell Auto' }));

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't tell Auto" }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tell Auto' })).toHaveProperty('disabled', false),
    );
  });
});
