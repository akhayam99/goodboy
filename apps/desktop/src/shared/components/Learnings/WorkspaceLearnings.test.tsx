// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../lib/repo', async () =>
  (await import('../../../store/storyHarness')).repoModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  insertSession,
  insertSessionContextItems,
  insertWorkspace,
  purgeSessionForDelete,
} from '@goodboy/db';
import type {
  IsoDateTime,
  SessionContextItemDraft,
  SessionContextItemId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { WorkspaceLearnings } from './WorkspaceLearnings';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const RELAY = 'session-relay' as SessionId;
const LEDGER = 'session-ledger' as SessionId;
const HOUR = 3_600_000;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });

let useAppStore: StoryStore;

type DraftParams = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly topic: string;
  readonly title: string;
  readonly hoursAgo: number;
};

const draft = ({
  id,
  sessionId,
  topic,
  title,
  hoursAgo,
}: DraftParams): SessionContextItemDraft => ({
  id: id as SessionContextItemId,
  sessionId,
  workspaceId: WORKSPACE_ID,
  kind: 'learning',
  title,
  text: `${title}, explained.`,
  topic,
  source: { role: 'investigator', agentId: null, turnStart: 4, turnEnd: 6 },
  audience: [],
  status: 'active',
  createdAt: new Date(Date.now() - hoursAgo * HOUR).toISOString() as IsoDateTime,
});

const statusOf = async (id: string) =>
  (
    await rowsOf<{ status: string }>({
      sql: 'SELECT status FROM session_context_items WHERE id = ?',
      params: [id],
    })
  )[0]?.status;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({});
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertSession(
    db,
    aSession({ id: RELAY, workspaceId: WORKSPACE_ID, goal: 'Retry webhooks' }),
  );
  await insertSession(
    db,
    aSession({ id: LEDGER, workspaceId: WORKSPACE_ID, goal: 'Ledger iterator' }),
  );
  await insertSessionContextItems({
    db: storySqlite(),
    items: [
      draft({
        id: 'borrow',
        sessionId: RELAY,
        topic: 'Rust',
        title: 'Why the borrow checker rejects the queue guard',
        hoursAgo: 2,
      }),
      draft({
        id: 'backfill',
        sessionId: LEDGER,
        topic: 'Database migrations',
        title: 'Backfill in batches',
        hoursAgo: 5,
      }),
      draft({
        id: 'lifetimes',
        sessionId: LEDGER,
        topic: 'Rust',
        title: 'Lifetimes in the snapshot iterator',
        hoursAgo: 30,
      }),
    ],
  });
  await purgeSessionForDelete({ db: storySqlite(), id: LEDGER });
});

afterEach(cleanup);

const renderLearnings = () =>
  render(
    <WorkspaceLearnings workspaceId={WORKSPACE_ID} topics={['Rust', 'Database migrations']} />,
  );

describe('WorkspaceLearnings', () => {
  it('counts what was learned and opens it grouped by topic, in the order you listed them', async () => {
    renderLearnings();

    const open = await screen.findByRole('button', { name: 'Open' });
    expect(open.closest('div')?.textContent).toBe('Learned·3·Open');
    fireEvent.click(open);

    const groups = screen.getAllByRole('region').map((group) => group.getAttribute('aria-label'));
    expect(groups).toEqual(['Rust', 'Database migrations']);
    const rust = within(screen.getByRole('region', { name: 'Rust' }));
    expect(rust.getAllByRole('button').map((row) => row.textContent)).toEqual([
      'Why the borrow checker rejects the queue guard2h ago',
      'Lifetimes in the snapshot iteratorDeleted session · 1d ago',
    ]);
  });

  it('keeps a learning from a deleted session, without a way to open the session', async () => {
    renderLearnings();
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));

    fireEvent.click(screen.getByRole('button', { name: /Lifetimes in the snapshot iterator/ }));

    expect(screen.getByText('Lifetimes in the snapshot iterator, explained.').tagName).toBe('P');
    expect(screen.queryByRole('button', { name: /Open session/ })).toBeNull();
    expect(screen.getByText(/Turns 4 to 6 · Debugger/).tagName).toBe('SPAN');
  });

  it('dismisses a learning with Undo, in the list and on disk', async () => {
    renderLearnings();
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: /Backfill in batches/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(async () => expect(await statusOf('backfill')).toBe('dismissed'));
    expect(screen.getByText('Dismissed').tagName).toBe('SPAN');
    expect(screen.queryByRole('button', { name: /^Backfill in batches/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hide' }).closest('div')?.textContent).toBe(
      'Learned·2·Hide',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Undo dismiss: Backfill in batches' }));

    await waitFor(async () => expect(await statusOf('backfill')).toBe('active'));
    expect(screen.queryByText('Dismissed')).toBeNull();
    expect(useAppStore.getState().workspaceLearnings[WORKSPACE_ID]?.length).toBe(3);
  });

  it('opens the session a learning came from', async () => {
    renderLearnings();
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: /Why the borrow checker/ }));

    fireEvent.click(screen.getByRole('button', { name: /Open session/ }));

    await waitFor(() => expect(useAppStore.getState().currentSessionId).toBe(RELAY));
  });
});
