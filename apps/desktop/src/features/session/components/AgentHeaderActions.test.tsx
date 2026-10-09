// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));

import { useRef, useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, ProviderRunId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
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
import { bindTarget } from '../../actions/registry';
import { HeaderConfirm } from '../../../shared/components/HeaderConfirm';
import type { ArmedAction } from '../../../shared/components/HeaderConfirm/armedAction';
import { AgentHeaderActions } from './AgentHeaderActions';

type BridgeArgs = {
  readonly statements?: ReadonlyArray<unknown>;
};

const bridge = (command: string, args?: BridgeArgs): Promise<unknown> => {
  if (command === 'db_transaction') {
    return Promise.resolve({
      status: 'committed',
      results: (args?.statements ?? []).map(() => ({ rowsAffected: 1, rows: [] })),
    });
  }
  if (command === 'db_execute') {
    return Promise.resolve({ rowsAffected: 1, lastInsertId: 0 });
  }
  if (command === 'db_select' || command.includes('_list')) {
    return Promise.resolve([]);
  }
  return Promise.resolve(null);
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type HarnessProps = {
  readonly agent: Agent;
  readonly onDeleted?: () => void;
};

const Harness = ({ agent, onDeleted }: HarnessProps) => {
  const [armed, setArmed] = useState<ArmedAction | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      <AgentHeaderActions
        agent={agent}
        sessionId={SESSION}
        allowInterrupt
        onArm={setArmed}
        {...(onDeleted === undefined ? {} : { onDeleted })}
      />
      <HeaderConfirm armed={armed} triggerWithin={ref} onClose={() => setArmed(null)} />
    </div>
  );
};

const renderFor = (agent: Agent, onDeleted = vi.fn()) => {
  seedActionState({ useAppStore, seed: { agents: [agent], mounts: [mountFixture()] } });
  render(<Harness agent={agent} onDeleted={onDeleted} />);
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
    expect(screen.queryByRole('button', { name: 'Interrupt' })).toBeNull();
    expect(screen.getByRole('button', { name: 'More agent actions' })).toBeDefined();
  });

  it('asks before delete under the header, deletes through the registry and leaves the page', async () => {
    const { onDeleted } = renderFor(agentFixture({ status: 'completed' }));
    openDeleteConfirm();
    const confirm = screen.getByRole('group', { name: 'Delete agent?' });
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
    expect(screen.queryByRole('group', { name: 'Delete agent?' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the delete confirm on Escape and returns focus to the overflow trigger', () => {
    renderFor(agentFixture({ status: 'completed' }));
    openDeleteConfirm();
    expect(screen.getByRole('group', { name: 'Delete agent?' })).toBeDefined();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });

    expect(screen.queryByRole('group', { name: 'Delete agent?' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More agent actions' }));
  });

  it('closes the delete confirm and focuses the trigger on Cancel', () => {
    renderFor(agentFixture({ status: 'completed' }));
    openDeleteConfirm();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('group', { name: 'Delete agent?' })).toBeNull();
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

  it('shows Interrupt only while a turn runs', () => {
    const agent = agentFixture({ status: 'running' });
    seedActionState({
      useAppStore,
      seed: {
        agents: [agent],
        mounts: [mountFixture()],
        turnStates: {
          [agent.id]: {
            kind: 'running',
            runId: 'run-1' as ProviderRunId,
            startedAt: FIXTURE_NOW,
          },
        },
      },
    });
    render(<Harness agent={agent} />);
    expect(screen.getByRole('button', { name: 'Interrupt' })).toBeDefined();
    cleanup();
    renderFor(agentFixture({ status: 'completed' }));
    expect(screen.queryByRole('button', { name: 'Interrupt' })).toBeNull();
  });

  it('lists every available verb in the overflow, the buttoned ones too, in the registry order', () => {
    const agent = agentFixture({ status: 'failed' });
    renderFor(agent);
    fireEvent.click(screen.getByRole('button', { name: 'More agent actions' }));
    const labels = screen
      .getAllByRole('menuitem')
      .map((item) => item.getAttribute('data-menu-label'));
    const registry = (
      bindTarget({
        state: useAppStore.getState(),
        target: { kind: 'agent', sessionId: SESSION, agentId: agent.id },
      })?.resolve({ viewing: { kind: 'agent', id: agent.id } }) ?? []
    ).map((action) => action.label);

    expect(labels).toEqual(registry);
    expect(labels).toContain('Delete agent');
    expect(labels).not.toContain('Open agent');
  });
});
