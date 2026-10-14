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
import { getAdoptionOfAgent, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import {
  AUTO_SEED_NOW,
  AUTO_SEED_SESSION,
  seedAutoSession,
} from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { adoptAgent } from '../../../store/slices/auto/adoptAgent';
import { AdoptedNotice } from './AdoptedNotice';

const SOURCE = brandId<AgentId>({ value: 'agent-source' });

let db: Database;

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  holder.db = db;
  await seedAutoSession({ db, agentIds: ['agent-source'] });
  await db.execute("UPDATE agents SET name = 'Implementer', kind = 'implementer' WHERE id = ?", [
    SOURCE,
  ]);
  let counter = 0;
  await adoptAgent({
    db,
    sessionId: AUTO_SEED_SESSION,
    sourceAgentId: SOURCE,
    source: {
      kind: 'implementer',
      roleLabel: 'Implementer',
      isTurnLive: false,
      goal: 'Add the retry cap to ledger-core',
      lastReply: 'Added the cap.',
      mountLabel: null,
      provider: 'anthropic',
      model: 'sonnet',
      effort: 'medium',
    },
    instruction: '',
    autoRouting: { provider: 'anthropic', model: 'opus', effort: 'medium' },
    primaryMountId: null,
    capUsd: 5,
    nowMs: AUTO_SEED_NOW,
    newId: () => {
      counter += 1;
      return `adopt-${counter}`;
    },
  });
  useAppStore.setState({ autoTreeViews: {} });
});

afterEach(cleanup);

type MountParams = {
  readonly isTurnLive?: boolean;
  readonly onOpenAuto?: () => void;
};

const mount = ({ isTurnLive = false, onOpenAuto = () => undefined }: MountParams = {}): void => {
  render(
    <AdoptedNotice
      sessionId={AUTO_SEED_SESSION}
      agentId={SOURCE}
      isTurnLive={isTurnLive}
      onOpenAuto={onOpenAuto}
    />,
  );
};

describe('the notice on an agent that moved to Auto', () => {
  it('says the chat is read only and offers Open Auto and Detach from Auto', () => {
    const onOpenAuto = vi.fn();
    mount({ onOpenAuto });

    expect(screen.getByText(/Moved to Auto\./)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open Auto' }));
    expect(onOpenAuto).toHaveBeenCalledOnce();
  });

  it('detaches the agent and refreshes the Auto views', async () => {
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Detach from Auto' }));

    await waitFor(async () => expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).toBeNull());
    await waitFor(() =>
      expect(useAppStore.getState().autoTreeViews[AUTO_SEED_SESSION]?.[0]?.delegations).toEqual([]),
    );
  });

  it('waits for the turn to end before it lets the person detach', () => {
    mount({ isTurnLive: true });

    expect(screen.getByRole('button', { name: 'Detach from Auto' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('shows the reason and keeps the link when the database says the agent is working', async () => {
    mount();
    await db.execute("UPDATE agents SET status = 'running' WHERE id = ?", [SOURCE]);

    fireEvent.click(screen.getByRole('button', { name: 'Detach from Auto' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Wait for the turn to end first.',
    );
    expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).not.toBeNull();
  });
});
