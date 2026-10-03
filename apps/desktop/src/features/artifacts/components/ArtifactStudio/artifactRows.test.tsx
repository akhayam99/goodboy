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
vi.mock('../../../skills/skills', async () =>
  (await import('../../../../store/storyHarness')).skillsModuleMock(),
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

const TITLES = {
  [READY_PLAN]: 'Add idempotency keys to payments-api charges',
  [RAN_PLAN]: 'Tighten rounding rules in payments-api invoices',
  [REPORT]: 'Q3 reconciliation drift, Northwind export',
  [WIREFRAME]: 'Acme refund approval flow',
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
      <ArtifactStudio sessionId={SESSION_ID} />
    </ToastProvider>,
  );

const rowOf = (id: ArtifactId) =>
  screen.queryByRole('button', {
    name: new RegExp(`^(Plan|Report|Wireframe) ${titleOf(id)}(,|$)`),
  });

const groupButton = (name: RegExp) => screen.getByRole('button', { name });

describe('artifact list rows', () => {
  it('groups by state and keeps Ran and Recently deleted closed', async () => {
    mountList();
    await waitFor(() => expect(rowOf(READY_PLAN)).not.toBeNull());
    expect(groupButton(/^Ready 3$/).getAttribute('aria-expanded')).toBe('true');
    expect(groupButton(/^Ran 1$/).getAttribute('aria-expanded')).toBe('false');
    expect(rowOf(RAN_PLAN)).toBeNull();
    fireEvent.click(groupButton(/^Ran 1$/));
    await waitFor(() => expect(rowOf(RAN_PLAN)).not.toBeNull());
  });

  it('shows the state of each row, with New on a wireframe nobody opened', async () => {
    mountList();
    await waitFor(() => expect(rowOf(WIREFRAME)).not.toBeNull());
    const states = screen.getAllByTestId('artifact-row-state').map((node) => node.textContent);
    expect(states).toEqual(expect.arrayContaining(['NewWireframe', 'Ready to run1 part']));
  });

  it('deletes a report from its row, then Undo puts the row back', async () => {
    mountList();
    await waitFor(() => expect(rowOf(REPORT)).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: `Delete ${TITLES[REPORT]}` }));
    await waitFor(() => expect(rowOf(REPORT)).toBeNull());
    expect(
      await rowsOf<{ status: string }>({
        sql: `SELECT status FROM session_artifacts WHERE id = '${REPORT}'`,
      }),
    ).toEqual([{ status: 'discarded' }]);
    expect(groupButton(/^Recently deleted 1$/)).toBeDefined();
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rowOf(REPORT)).not.toBeNull());
    expect(
      await rowsOf<{ status: string }>({
        sql: `SELECT status FROM session_artifacts WHERE id = '${REPORT}'`,
      }),
    ).toEqual([{ status: 'active' }]);
  });

  it('offers Delete permanently only inside Recently deleted', async () => {
    mountList();
    await waitFor(() => expect(rowOf(REPORT)).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'Delete permanently' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: `Delete ${TITLES[REPORT]}` }));
    await waitFor(() => expect(rowOf(REPORT)).toBeNull());
    expect(screen.queryByRole('button', { name: 'Delete permanently' })).toBeNull();
    fireEvent.click(groupButton(/^Recently deleted 1$/));
    const forGood = await screen.findByRole('button', { name: 'Delete permanently' });
    fireEvent.click(forGood);
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
    fireEvent.click(screen.getByRole('button', { name: `Delete ${TITLES[WIREFRAME]}` }));
    await waitFor(() => expect(rowOf(WIREFRAME)).toBeNull());
    fireEvent.click(groupButton(/^Recently deleted 1$/));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(rowOf(WIREFRAME)).not.toBeNull());
  });
});
