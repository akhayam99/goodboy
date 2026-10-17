// @vitest-environment happy-dom

const holder = vi.hoisted(() => {
  const state: { db: unknown } = { db: null };
  return state;
});

vi.mock('../../../shared/lib/db', () => ({
  get tauriDatabase() {
    return holder.db;
  },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getAdoptionOfAgent, listAutoOutbox, setSetting, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { AUTO_SEED_SESSION, seedAutoSession } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type Agent, type AgentId, type WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import { invokeAgentList } from '../../workflows/workflows';
import { AutoReleaseContext } from '../autoReleaseContext';
import { MoveToAutoPanel } from './MoveToAutoPanel';

const SOURCE = brandId<AgentId>({ value: 'agent-source' });

let db: Database;
let source: Agent;

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  holder.db = db;
  await seedAutoSession({ db, agentIds: ['agent-source'] });
  await db.execute("UPDATE agents SET name = 'Implementer', kind = 'implementer' WHERE id = ?", [
    SOURCE,
  ]);
  const agents = await invokeAgentList(AUTO_SEED_SESSION);
  const found = agents.find((agent) => agent.id === SOURCE);
  if (found === undefined) {
    throw new Error('no source agent');
  }
  source = found;
  useAppStore.setState({
    sessions: [
      aSession({
        id: AUTO_SEED_SESSION,
        workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
      }),
    ],
    sessionPhaseRuns: { [AUTO_SEED_SESSION]: agents },
    agentTurnState: {},
    transcripts: {},
    autoTreeViews: {},
    sessionBudgets: {},
    undoStack: [],
    navigate: vi.fn(),
  });
});

afterEach(cleanup);

type MountParams = {
  readonly onClose?: () => void;
  readonly isReleased?: boolean;
};

const mount = ({ onClose = () => undefined, isReleased = true }: MountParams = {}): void => {
  render(
    <AutoReleaseContext.Provider value={isReleased}>
      <MoveToAutoPanel sessionId={AUTO_SEED_SESSION} agent={source} onClose={onClose} />
    </AutoReleaseContext.Provider>,
  );
};

describe('the Move to Auto panel', () => {
  it('asks "What should Auto do next?" in a field that may stay empty', () => {
    mount();

    const field = screen.getByRole('textbox', { name: 'What should Auto do next?' });
    expect(field).toHaveProperty('value', '');
    expect(screen.getByRole('button', { name: 'Move to Auto' })).toHaveProperty('disabled', false);
  });

  it('moves the agent with the words of the user, opens Auto and closes', async () => {
    const onClose = vi.fn();
    mount({ onClose });
    fireEvent.change(screen.getByRole('textbox', { name: 'What should Auto do next?' }), {
      target: { value: 'Review it after the tests' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Move to Auto' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    const adoption = await getAdoptionOfAgent({ db, agentId: SOURCE });
    expect(adoption).not.toBeNull();
    const rows = await listAutoOutbox({
      db,
      treeId: adoption?.treeId ?? brandId({ value: 'none' }),
    });
    expect(JSON.stringify(rows[0]?.payload)).toContain('Review it after the tests');
    const navigate = vi.mocked(useAppStore.getState().navigate);
    expect(navigate.mock.calls[0]?.[0]).toMatchObject({
      to: { at: 'agent', sessionId: AUTO_SEED_SESSION },
    });
  });

  it('keeps the panel open and says why when Auto refuses', async () => {
    await db.exec('PRAGMA foreign_keys = OFF');
    await db.execute("UPDATE agents SET workflow_run_id = 'run-harborline' WHERE id = ?", [SOURCE]);
    await db.exec('PRAGMA foreign_keys = ON');
    const onClose = vi.fn();
    mount({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Move to Auto' }));

    expect(await screen.findByText('Pause or finish the run first.')).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
    expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).toBeNull();
  });

  it('moves the agent even when an old experiment row still says false', async () => {
    const onClose = vi.fn();
    await setSetting(db, 'agents.autoExperiment', 'false');
    mount({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Move to Auto' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).not.toBeNull();
  });

  it('says Auto is not in this build when the release gate is closed, and moves nothing', async () => {
    mount({ isReleased: false });

    fireEvent.click(screen.getByRole('button', { name: 'Move to Auto' }));

    expect(await screen.findByText('Auto is not available in this build.')).toBeDefined();
    expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).toBeNull();
  });

  it('lets the person try again after a failure and cancel at any time', async () => {
    const onClose = vi.fn();
    await db.exec('PRAGMA foreign_keys = OFF');
    await db.execute("UPDATE agents SET workflow_run_id = 'run-harborline' WHERE id = ?", [SOURCE]);
    await db.exec('PRAGMA foreign_keys = ON');
    mount({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Move to Auto' }));
    await screen.findByText('Pause or finish the run first.');
    await db.execute('UPDATE agents SET workflow_run_id = NULL WHERE id = ?', [SOURCE]);

    fireEvent.click(screen.getByRole('button', { name: 'Move to Auto' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).not.toBeNull();
  });

  it('closes without moving anything on Cancel', async () => {
    const onClose = vi.fn();
    mount({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).toBeNull();
  });

  it('offers Detach as the undo of the move', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Move to Auto' }));
    await waitFor(async () =>
      expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).not.toBeNull(),
    );
    await waitFor(() => expect(useAppStore.getState().undoStack).toHaveLength(1));

    const isUndone = await useAppStore.getState().undoLastOperation({});

    expect(isUndone).toBe(true);
    expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).toBeNull();
  });
});
