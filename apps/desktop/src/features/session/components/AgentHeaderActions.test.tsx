// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type Agent, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { aDelegation, aTree, aView } from '../../auto/testing/autoViewFixtures';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  AGENT,
  FIXTURE_NOW,
  SESSION,
  agentFixture,
  mountFixture,
  seedActionState,
} from '../../../__tests__/helpers/actionFixtures';
import type { AgentKind } from '../agent-kind';
import { AgentHeaderActions } from './AgentHeaderActions';

const KINDS: ReadonlyArray<AgentKind> = [
  'generic',
  'planner',
  'implementer',
  'tester',
  'reviewer',
  'auto',
  'scout',
  'resolver',
  'rewriter',
];
const STATUSES: ReadonlyArray<Agent['status']> = ['running', 'failed', 'completed', 'stopped'];
let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_execute: { rowsAffected: 1, lastInsertId: 0 },
    db_select: [],
    db_transaction: { status: 'committed', results: [] },
  });
});

afterEach(cleanup);

const renderFor = (agent: Agent, onDeleted = vi.fn()) => {
  seedActionState({ useAppStore, seed: { agents: [agent], mounts: [mountFixture()] } });
  render(<AgentHeaderActions agent={agent} sessionId={SESSION} allowStop onDeleted={onDeleted} />);
  return { onDeleted };
};

const liveAgent = (): Agent | undefined => useAppStore.getState().sessionPhaseRuns[SESSION]?.[0];

const openDeleteConfirm = () => {
  fireEvent.click(screen.getByRole('button', { name: 'More agent actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name: /Delete agent/ }));
};

describe('AgentHeaderActions', () => {
  it('shows the registry lifecycle buttons for a failed agent and closes it', async () => {
    renderFor(agentFixture({ status: 'failed' }));
    expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(liveAgent()?.doneAt).not.toBeUndefined();
  });

  it('shows no lifecycle button once an agent finished on its own', () => {
    renderFor(agentFixture({ status: 'completed' }));
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
    expect(screen.getByRole('button', { name: 'More agent actions' })).toBeDefined();
  });

  it('asks before delete in a popover anchored to the overflow, deletes through the registry and leaves the page', async () => {
    const { onDeleted } = renderFor(agentFixture({ status: 'completed' }));
    openDeleteConfirm();
    const confirm = screen.getByRole('dialog', { name: 'Delete agent?' });
    expect(confirm.closest('[data-dropdown-portal]')).not.toBeNull();
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    });
    expect(
      (useAppStore.getState().sessionPhaseRuns[SESSION] ?? []).filter(
        (agent) => agent.id === AGENT && agent.deletedAt == null,
      ),
    ).toEqual([]);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('keeps Delete out of the header at rest: no trash icon and no labelled danger button', () => {
    renderFor(agentFixture({ status: 'completed' }));
    expect(screen.queryByRole('button', { name: 'Delete agent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Delete agent?' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the delete confirm on Escape and returns focus to the overflow trigger', () => {
    renderFor(agentFixture({ status: 'completed' }));
    openDeleteConfirm();
    expect(screen.getByRole('dialog', { name: 'Delete agent?' })).toBeDefined();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Delete agent?' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More agent actions' }));
  });

  it('closes the delete confirm and focuses the trigger on Cancel', () => {
    renderFor(agentFixture({ status: 'completed' }));
    openDeleteConfirm();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Delete agent?' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More agent actions' }));
  });

  it('keeps the state button word at every width and folds it below 560px', () => {
    renderFor(agentFixture({ status: 'failed' }));
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.innerHTML).not.toContain('sr-only');
    expect(close.closest('[data-slot="header-actions-button"]')?.className).toContain(
      '@max-[560px]:hidden',
    );
  });

  it('shows Stop only while a turn runs', () => {
    const agent = agentFixture({ status: 'running' });
    seedActionState({
      useAppStore,
      seed: {
        agents: [agent],
        mounts: [mountFixture()],
        turnStates: {
          [agent.id]: {
            kind: 'running',
            runId: brandId<ProviderRunId>({ value: 'run-1' }),
            startedAt: FIXTURE_NOW,
          },
        },
      },
    });
    render(<AgentHeaderActions agent={agent} sessionId={SESSION} allowStop />);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDefined();
    cleanup();
    renderFor(agentFixture({ status: 'completed' }));
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it.each(KINDS)('keeps the %s header menu short in every lifecycle state', (kind) => {
    for (const status of STATUSES) {
      const agent = agentFixture({ status, kind, name: 'Harborline' });
      seedActionState({ useAppStore, seed: { agents: [agent], mounts: [mountFixture()] } });
      useAppStore.setState({ agentKindOverride: { [agent.id]: kind } });
      render(<AgentHeaderActions agent={agent} sessionId={SESSION} hasStateButton={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'More agent actions' }));
      const labels = screen
        .getAllByRole('menuitem')
        .map((item) => item.getAttribute('data-menu-label'));
      expect(labels.length).toBeLessThanOrEqual(5);
      expect(labels).toContain('Rename');
      expect(labels).toContain('Delete agent');
      expect(labels).not.toContain('Copy name');
      expect(labels).not.toContain('Show its changes');
      expect(labels).not.toContain('Change model');
      cleanup();
    }
  });

  it('keeps Close on an open agent and Reopen on a closed one, never both', () => {
    const open = agentFixture({ status: 'failed', name: 'Harborline' });
    const closed = agentFixture({
      status: 'failed',
      name: 'Harborline',
      doneAt: FIXTURE_NOW,
    });
    const labelsOf = (agent: Agent) => {
      seedActionState({ useAppStore, seed: { agents: [agent], mounts: [mountFixture()] } });
      render(<AgentHeaderActions agent={agent} sessionId={SESSION} hasStateButton={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'More agent actions' }));
      const labels = screen
        .getAllByRole('menuitem')
        .map((item) => item.getAttribute('data-menu-label'));
      cleanup();
      return labels;
    };
    const openLabels = labelsOf(open);
    const closedLabels = labelsOf(closed);

    expect(openLabels).toContain('Close');
    expect(openLabels).not.toContain('Reopen');
    expect(closedLabels).toContain('Reopen');
    expect(closedLabels).not.toContain('Close');
    expect(closedLabels.length).toBeLessThanOrEqual(5);
  });

  it.each(['plain', 'adopted', 'autoRoot'] as const)(
    'keeps the %s Auto state within five rows and names every row it keeps',
    (state) => {
      const agent = agentFixture({ status: 'completed', kind: 'implementer', name: 'Harborline' });
      seedActionState({ useAppStore, seed: { agents: [agent], mounts: [mountFixture()] } });
      const view = aView({
        delegations:
          state === 'adopted'
            ? [
                {
                  ...aDelegation({ key: 'adopted', role: 'implementer', state: 'settled' }),
                  childAgentId: agent.id,
                  isAdopted: true,
                },
              ]
            : [],
      });
      useAppStore.setState({
        agentKindOverride: { [agent.id]: state === 'autoRoot' ? 'auto' : 'implementer' },
        autoTreeViews:
          state === 'plain'
            ? {}
            : {
                [SESSION]: [
                  {
                    ...view,
                    tree: {
                      ...aTree(),
                      rootAgentId: state === 'autoRoot' ? agent.id : view.tree.rootAgentId,
                    },
                  },
                ],
              },
        transcripts: {
          [agent.id]: [
            {
              kind: 'assistant_text',
              runId: brandId<ProviderRunId>({ value: 'run-ledger-core' }),
              delta: 'The retry is fixed.',
              at: brandId<IsoDateTime>({ value: '2026-10-13T12:00:00.000Z' }),
            },
          ],
        },
      });
      render(<AgentHeaderActions agent={agent} sessionId={SESSION} hasStateButton={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'More agent actions' }));
      const labels = screen
        .getAllByRole('menuitem')
        .map((item) => item.getAttribute('data-menu-label'));
      const expected = {
        plain: ['Rename', 'Let Auto take it from here', 'Copy last reply', 'Delete agent'],
        adopted: ['Rename', 'Detach from Auto', 'Copy last reply', 'Delete agent'],
        autoRoot: ['Rename', 'Mark finished', 'Copy last reply', 'Delete agent'],
      } as const;
      expect(labels).toEqual(expected[state]);
    },
  );
});
