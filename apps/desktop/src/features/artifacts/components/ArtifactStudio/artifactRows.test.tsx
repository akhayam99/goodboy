// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../chat/turn', async () =>
  (await import('../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../providers/providers', async () =>
  (await import('../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../providers/routing', async () =>
  (await import('../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../budget/budget', async () =>
  (await import('../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../workflows/workflows', async () =>
  (await import('../../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../worktree/worktree', async () =>
  (await import('../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../../store/storyHarness')).repoModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { insertArtifact, insertSession, insertWorkspace, markArtifactOpened } from '@goodboy/db';
import type { AgentId, ArtifactId, ArtifactKind, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
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
} from '../../../../store/storyHarness';
import { ArtifactStudio } from './index';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const SESSION_ID = 'session-payments' as SessionId;
const AGENT_ID = 'agent-planner' as AgentId;
const READY_PLAN = 'artifact-ready-plan' as ArtifactId;
const RAN_PLAN = 'artifact-ran-plan' as ArtifactId;
const REPORT = 'artifact-report' as ArtifactId;
const WIREFRAME = 'artifact-wireframe' as ArtifactId;
const OLD_REPORT = 'artifact-old-report' as ArtifactId;

const TITLES = {
  [READY_PLAN]: 'Add idempotency keys to payments-api charges',
  [RAN_PLAN]: 'Tighten rounding rules in payments-api invoices',
  [REPORT]: 'Q3 reconciliation drift, Northwind export',
  [WIREFRAME]: 'Acme refund approval flow',
  [OLD_REPORT]: 'Payout timing summary',
} as const;

const titleOf = (id: ArtifactId): string =>
  Object.entries(TITLES).find(([key]) => key === id)?.[1] ?? id;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const session = aSession({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Fix duplicate credit',
});

let useAppStore: StoryStore;

const seedArtifact = async ({
  id,
  kind,
  status = 'active',
}: {
  readonly id: ArtifactId;
  readonly kind: ArtifactKind;
  readonly status?: 'active' | 'consumed';
}) => {
  const db = storySqlite();
  await insertArtifact({
    db,
    input: {
      id,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      kind,
      schemaVersion: 1,
      title: titleOf(id),
      sourceFormat: kind === 'wireframe' ? 'json' : 'markdown',
      sourceText: kind === 'wireframe' ? '{}' : '## Goal',
      metadata:
        kind === 'plan'
          ? { clusters: [{ title: 'Schema change', instructions: 'Add the column' }] }
          : kind === 'report'
            ? { reportType: 'session-summary' }
            : { fidelity: 'low', designProfile: {} },
    },
  });
  if (status === 'consumed') {
    await db.execute('UPDATE session_artifacts SET status = ? WHERE id = ?', [status, id]);
  }
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ artifact_mirror_remove: true });
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertSession(db, session);
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, 0, 'Planner', 'completed')",
    [AGENT_ID, SESSION_ID],
  );
  await seedArtifact({ id: READY_PLAN, kind: 'plan' });
  await seedArtifact({ id: RAN_PLAN, kind: 'plan', status: 'consumed' });
  await seedArtifact({ id: REPORT, kind: 'report' });
  await seedArtifact({ id: WIREFRAME, kind: 'wireframe' });
  await markArtifactOpened({ db, artifactId: REPORT, openedAt: Date.now() });
  useAppStore.setState({
    workspaces: [workspace],
    sessions: [session],
    currentSessionId: SESSION_ID,
  });
  await useAppStore.getState().loadSessionArtifacts(SESSION_ID);
  await useAppStore.getState().loadSessionPlans(SESSION_ID);
});

afterEach(cleanup);

const mountList = () =>
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <ArtifactStudio sessionId={SESSION_ID} />
      </ObjectMenuProvider>
    </ToastProvider>,
  );

const rowsNamed = (id: ArtifactId) =>
  screen.queryAllByRole('button', {
    name: new RegExp(`^(Plan|Report|Wireframe) ${titleOf(id)}(,|$)`),
  });

const isInDeleted = (node: HTMLElement): boolean =>
  node.closest('[data-testid="artifact-group-deleted"]') !== null;

const rowOf = (id: ArtifactId) => rowsNamed(id).find((node) => !isInDeleted(node)) ?? null;

const deletedRowOf = (id: ArtifactId) => rowsNamed(id).find(isInDeleted) ?? null;

type PresentParams = {
  readonly node: HTMLElement | null;
};

const present = ({ node }: PresentParams): HTMLElement => {
  if (node === null) {
    throw new Error('row missing');
  }
  return node;
};

const deleteFromMenu = ({ id }: { readonly id: ArtifactId }) => {
  fireEvent.contextMenu(present({ node: rowOf(id) }));
  fireEvent.click(screen.getByRole('menuitem', { name: /^Delete\b/ }));
};

const groupHeading = (name: RegExp) => screen.getByRole('heading', { level: 2, name });

const showTrash = () =>
  within(screen.getByTestId('artifact-group-deleted')).getByRole('button', { name: 'Show' });

describe('artifact list rows', () => {
  it('groups by state under plain labels, a run plan under Consumed and in view', async () => {
    mountList();
    await waitFor(() => expect(rowOf(READY_PLAN)).not.toBeNull());
    expect(groupHeading(/^Ready 3$/)).toBeDefined();
    expect(groupHeading(/^Consumed$/)).toBeDefined();
    expect(screen.queryByRole('heading', { name: /^Ran\b/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Consumed\b/ })).toBeNull();
    expect(rowOf(RAN_PLAN)).not.toBeNull();
  });

  it('shows a state only where the group does not say it, with New on a fresh unopened wireframe', async () => {
    mountList();
    await waitFor(() => expect(rowOf(WIREFRAME)).not.toBeNull());
    const states = screen.getAllByTestId('artifact-row-state').map((node) => node.textContent);
    expect(states).toEqual(expect.arrayContaining(['New', 'Ready to run']));
    expect(states).not.toContain('Ready');
    expect(states).not.toContain('Ran');
  });

  it('keeps each state on one line and draws no kind column', async () => {
    mountList();
    await waitFor(() => expect(rowOf(READY_PLAN)).not.toBeNull());
    const frame = rowOf(READY_PLAN)?.closest('[data-testid="artifact-row-frame"]') as HTMLElement;
    expect(within(frame).queryByTestId('artifact-row-progress')).toBeNull();
    expect(within(frame).queryByTestId('artifact-row-kind')).toBeNull();
    expect(within(frame).getByTestId('artifact-row-state').textContent).toBe('Ready to run');
  });

  it('does not flag an old unopened artifact as New on the real database', async () => {
    await seedArtifact({ id: OLD_REPORT, kind: 'report' });
    await storySqlite().execute('UPDATE session_artifacts SET created_at = ? WHERE id = ?', [
      Date.now() - 5 * 24 * 60 * 60 * 1000,
      OLD_REPORT,
    ]);
    await useAppStore.getState().loadSessionArtifacts(SESSION_ID);
    mountList();
    await waitFor(() => expect(rowOf(OLD_REPORT)).not.toBeNull());
    const stateOf = (id: ArtifactId) =>
      rowOf(id)
        ?.closest('[data-testid="artifact-row-frame"]')
        ?.querySelector('[data-testid="artifact-row-state"]')?.textContent;
    expect(stateOf(OLD_REPORT)).toBeUndefined();
    expect(stateOf(WIREFRAME)).toBe('New');
  });

  it('deletes a report from its row, then Undo puts the row back', async () => {
    mountList();
    await waitFor(() => expect(rowOf(REPORT)).not.toBeNull());
    deleteFromMenu({ id: REPORT });
    await waitFor(() => expect(rowOf(REPORT)).toBeNull());
    expect(
      await rowsOf<{ status: string }>({
        sql: `SELECT status FROM session_artifacts WHERE id = '${REPORT}'`,
      }),
    ).toEqual([{ status: 'discarded' }]);
    expect(groupHeading(/^Recently deleted$/)).toBeDefined();
    expect(deletedRowOf(REPORT)).toBeNull();
    fireEvent.click(showTrash());
    expect(deletedRowOf(REPORT)).not.toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rowOf(REPORT)).not.toBeNull());
    expect(
      await rowsOf<{ status: string }>({
        sql: `SELECT status FROM session_artifacts WHERE id = '${REPORT}'`,
      }),
    ).toEqual([{ status: 'active' }]);
  });

  it('offers Delete permanently only in the right click of a Recently deleted row', async () => {
    mountList();
    await waitFor(() => expect(rowOf(REPORT)).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'Delete permanently' })).toBeNull();
    deleteFromMenu({ id: REPORT });
    await waitFor(() => expect(rowOf(REPORT)).toBeNull());
    expect(screen.queryByRole('button', { name: 'Delete permanently' })).toBeNull();
    fireEvent.click(showTrash());
    expect(screen.queryByRole('button', { name: 'Delete permanently' })).toBeNull();
    fireEvent.contextMenu(present({ node: deletedRowOf(REPORT) }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Delete permanently/ }));
    const panel = await screen.findByText(/for good\?/);
    expect(panel.textContent).toContain(TITLES[REPORT]);
    fireEvent.click(
      within(panel.closest('[role]') as HTMLElement).getByRole('button', {
        name: 'Delete permanently',
      }),
    );
    await waitFor(() =>
      expect(
        rowsOf({ sql: `SELECT id FROM session_artifacts WHERE id = '${REPORT}'` }),
      ).resolves.toEqual([]),
    );
  });

  it('restores a deleted artifact from Recently deleted', async () => {
    mountList();
    await waitFor(() => expect(rowOf(WIREFRAME)).not.toBeNull());
    deleteFromMenu({ id: WIREFRAME });
    await waitFor(() => expect(rowOf(WIREFRAME)).toBeNull());
    fireEvent.click(showTrash());
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(rowOf(WIREFRAME)).not.toBeNull());
  });
});
