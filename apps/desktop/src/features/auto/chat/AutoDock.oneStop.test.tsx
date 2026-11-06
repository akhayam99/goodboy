// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { registerTreeStopPort } from '../treeStopPort';
import { aDelegation, aView, FIXTURE_SESSION } from '../testing/autoViewFixtures';
import { AutoDockUnderTest } from '../testing/AutoDockUnderTest';

const ROOT = anAgent({
  id: brandId<AgentId>({ value: 'agent-auto' }),
  sessionId: FIXTURE_SESSION,
  name: 'Auto',
  status: 'running',
  kind: 'custom',
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  registerTreeStopPort({ port: null });
});

const renderDock = ({ view }: { readonly view: ReturnType<typeof aView> }) => {
  useAppStore.setState({ autoTreeViews: { [FIXTURE_SESSION]: [view] } });
  return render(<AutoDockUnderTest view={view} rootAgent={ROOT} onOpenArtifact={vi.fn()} />);
};

describe('the one Stop of Auto', () => {
  it('names the agents it stops, a queued one included, and Change approach is gone', async () => {
    const stop = vi.fn(async () => 'stopped' as const);
    registerTreeStopPort({ port: stop });
    const view = aView({
      phase: 'waiting',
      delegations: [
        aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
        aDelegation({ key: 'test', role: 'tester', state: 'accepted' }),
      ],
    });
    renderDock({ view });

    screen.getByText('Implementer running, Tester queued');
    expect(screen.queryByRole('button', { name: 'Change approach' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Stop Auto and 2 agents' }));

    await waitFor(() => expect(stop).toHaveBeenCalledWith({ treeId: view.tree.id }));
  });

  it('reads Stop Auto when no agent runs', () => {
    renderDock({ view: aView({ phase: 'deciding' }) });

    screen.getByRole('button', { name: 'Stop Auto' });
  });

  it('keeps Stop on screen while the root replies at the limit', () => {
    const run = brandId<ProviderRunId>({ value: 'run-1' });
    const startedAt = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
    useAppStore.setState({
      agentTurnState: { [ROOT.id]: { kind: 'running', runId: run, startedAt } },
    });

    renderDock({ view: aView({ phase: 'waiting', spentUsd: 10, capUsd: 10 }) });

    screen.getByRole('button', { name: 'Stop Auto' });
  });

  it('shows Stopping while the tree exits, and the failure stays on screen', async () => {
    registerTreeStopPort({ port: vi.fn(async () => 'stuck' as const) });
    renderDock({ view: aView({ phase: 'deciding' }) });

    fireEvent.click(screen.getByRole('button', { name: 'Stop Auto' }));

    await screen.findByText('Some agents are still running. Press Stop again to retry.');
    screen.getByRole('button', { name: 'Stop Auto' });
  });
});
