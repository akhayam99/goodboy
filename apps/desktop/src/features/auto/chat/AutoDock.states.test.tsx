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
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import {
  aDelegation,
  anArtifactRow,
  aPlanRow,
  aView,
  FIXTURE_SESSION,
} from '../testing/autoViewFixtures';
import { AutoDockUnderTest } from '../testing/AutoDockUnderTest';
import { registerTreeRetryPort } from '../treeRetryPort';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const ROOT = anAgent({ id: brandId<AgentId>({ value: 'agent-auto' }) });

type RenderParams = {
  readonly view: AutoTreeView;
  readonly onOpenArtifact?: (artifactId: string) => void;
};

const renderDock = ({ view, onOpenArtifact = vi.fn() }: RenderParams) => {
  useAppStore.setState({ autoTreeViews: { [FIXTURE_SESSION]: [view] } });
  return render(<AutoDockUnderTest view={view} rootAgent={ROOT} onOpenArtifact={onOpenArtifact} />);
};

describe('AutoDock', () => {
  it('asks for the plan with one primary, the approve label, and two quiet buttons', () => {
    const onOpenArtifact = vi.fn();
    renderDock({
      view: aView({ phase: 'waiting', artifacts: [aPlanRow()] }),
      onOpenArtifact,
    });

    screen.getByText('Plan v1 needs approval');
    screen.getByRole('button', { name: 'Approve and start Build' });
    screen.getByRole('button', { name: 'Ask for changes' });
    fireEvent.click(screen.getByRole('button', { name: 'Open plan Retry-safe credit retries' }));
    expect(onOpenArtifact).toHaveBeenCalledWith('artifact-plan');
    expect(document.querySelectorAll('[data-auto-dock] button')).toHaveLength(3);
  });

  it('asks for the plan that waits when an older plan was used', () => {
    const waiting = anArtifactRow({
      id: 'artifact-plan-2',
      kind: 'plan',
      title: 'Second',
      revision: 2,
    });
    const used = {
      ...anArtifactRow({ id: 'artifact-plan-1', kind: 'plan', title: 'First' }),
      status: 'consumed',
    } as const;
    renderDock({ view: aView({ phase: 'waiting', artifacts: [waiting, used] }) });

    screen.getByText('Plan v2 needs approval');
    screen.getByRole('button', { name: 'Approve and start Build' });
    expect(screen.queryByText('Plan v1 used')).toBeNull();
  });

  it('says changes asked while the plan is revised, with Open plan only', () => {
    renderDock({
      view: aView({
        phase: 'waiting',
        artifacts: [aPlanRow({ approvalState: 'revising', openRevise: 'delegation-revise' })],
      }),
    });

    screen.getByText('Plan v1 · changes asked');
    expect(screen.queryByRole('button', { name: 'Approve and start Build' })).toBeNull();
    screen.getByRole('button', { name: 'Open plan Retry-safe credit retries' });
  });

  it('says approved in the artifact tone with Open plan only', () => {
    renderDock({
      view: aView({
        phase: 'waiting',
        artifacts: [aPlanRow({ approvalState: 'approved', approvedRevision: 1 })],
      }),
    });

    expect(screen.getByText('Plan v1 approved').getAttribute('data-tone')).toBe('merged');
    expect(screen.queryByRole('button', { name: 'Approve and start Build' })).toBeNull();
  });

  it('says used once a writer took the plan', () => {
    renderDock({
      view: aView({ phase: 'waiting', artifacts: [{ ...aPlanRow(), status: 'consumed' }] }),
    });

    screen.getByText('Plan v1 used');
    expect(screen.queryByRole('button', { name: 'Approve and start Build' })).toBeNull();
  });

  it('says no approval needed when Auto asks you nothing', () => {
    renderDock({
      view: { ...aView({ phase: 'waiting', artifacts: [aPlanRow()] }), level: 'run' },
    });

    screen.getByText('Plan v1 · no approval needed');
    expect(screen.queryByRole('button', { name: 'Approve and start Build' })).toBeNull();
  });

  it('folds to one live row with its verb when there is no plan', () => {
    renderDock({
      view: aView({
        phase: 'waiting',
        delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })],
      }),
    });

    expect(document.querySelector('[data-dock-plan]')).toBeNull();
    screen.getByText('Implementer running');
    screen.getByRole('button', { name: 'Stop Auto and 1 agent' });
  });

  it('shows the limit with one filled Raise and a quiet Stop, and leaves the chat', () => {
    renderDock({
      view: aView({ phase: 'waiting', spentUsd: 10, capUsd: 10 }),
    });

    screen.getByText('At the $10.00 limit. Nothing new starts.');
    const raise = screen.getByRole('button', { name: 'Raise to $20.00' });
    expect(raise.getAttribute('data-variant')).toBe('primary');
    const stop = screen.getByRole('button', { name: 'Stop Auto' });
    expect(stop.getAttribute('data-variant')).toBe('quiet');
  });

  it('shows a failed tree with its reason and a filled Retry', async () => {
    const retry = vi.fn(async () => ({ kind: 'retried' as const }));
    registerTreeRetryPort({ port: retry });
    const base = aView({ phase: 'blocked' });
    const view = { ...base, tree: { ...base.tree, blockedReason: 'The provider did not answer.' } };
    renderDock({ view });

    screen.getByText('The provider did not answer.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(retry).toHaveBeenCalledWith({ treeId: view.tree.id }));
    registerTreeRetryPort({ port: null });
  });

  it('keeps the old state and shows why when the retry is refused', async () => {
    registerTreeRetryPort({
      port: vi.fn(async () => ({ kind: 'refused' as const, message: 'The tree moved on.' })),
    });
    const base = aView({ phase: 'blocked' });
    const view = { ...base, tree: { ...base.tree, blockedReason: 'The provider did not answer.' } };
    renderDock({ view });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await screen.findByText('The tree moved on.');
    screen.getByText('The provider did not answer.');
    registerTreeRetryPort({ port: null });
  });

  it('shows one ask: an open permission hides the plan row and its filled button', () => {
    const run = brandId<ProviderRunId>({ value: 'run-1' });
    const at = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
    useAppStore.setState({
      agentTurnState: { [ROOT.id]: { kind: 'blocked', runId: run, blockedAt: at } },
      transcripts: {
        [ROOT.id]: [
          {
            kind: 'permission_request',
            runId: run,
            toolUseId: 'tool-1',
            toolName: 'Read',
            input: {},
            at,
          },
        ],
      },
    });

    renderDock({ view: aView({ phase: 'waiting', artifacts: [aPlanRow()] }) });

    expect(screen.queryByRole('button', { name: 'Approve and start Build' })).toBeNull();
  });

  it('hides Approve while the next step revises that plan', () => {
    renderDock({
      view: aView({
        phase: 'waiting',
        artifacts: [aPlanRow()],
        delegations: [
          {
            ...aDelegation({ key: 'plan', role: 'planner', state: 'awaiting_confirm' }),
            reviseOf: 'artifact-plan',
          },
        ],
      }),
    });

    expect(screen.queryByRole('button', { name: 'Approve and start Build' })).toBeNull();
    screen.getByRole('region', { name: 'Next step' });
  });

  it('draws nothing when no plan exists and nothing runs', () => {
    renderDock({ view: aView({ phase: 'done' }) });

    expect(document.querySelector('[data-auto-dock]')?.childElementCount).toBe(0);
  });
});
