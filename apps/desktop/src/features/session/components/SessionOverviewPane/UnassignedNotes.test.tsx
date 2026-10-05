// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  DiffComment,
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { UnassignedNotes } from './UnassignedNotes';

const SESSION = 'session-ledger-export' as SessionId;
const PROJECT = 'project-payments-api' as ProjectId;

const note = (id: string, extra: Partial<DiffComment> = {}): DiffComment => ({
  id,
  sessionId: SESSION,
  filePath: 'src/ledger.ts',
  body: `Cast the ledger id in ${id}`,
  status: 'open',
  createdAt: '2026-10-01T10:00:00.000Z' as IsoDateTime,
  anchor: { side: 'new', lineNumber: 21 },
  authorKind: 'user',
  ...extra,
});

const mount: SessionProjectMount = {
  mountId: 'mount-a' as MountId,
  sessionId: SESSION,
  projectId: PROJECT,
  mountName: 'payments-api',
  worktreePath: '/wt/payments-api',
  lastWorktreePath: null,
  repoRoot: '/repo/payments-api',
  branch: 'feat/export',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('UnassignedNotes', () => {
  it('shows nothing when every note belongs to a branch', () => {
    useAppStore.setState({
      diffComments: { [SESSION]: [note('a', { projectId: PROJECT, branch: 'feat/export' })] },
      loadDiffComments: async () => undefined,
    });
    render(<UnassignedNotes sessionId={SESSION} />);
    expect(screen.queryByRole('region', { name: 'Unassigned notes' })).toBeNull();
  });

  it('reads each unassigned note in full and moves one to the active branch', () => {
    const assign = vi.fn(async () => undefined);
    useAppStore.setState({
      diffComments: {
        [SESSION]: [
          note('a'),
          note('b', { projectId: PROJECT, branch: 'feat/export' }),
          note('c', { body: 'Link the export from the page header' }),
        ],
      },
      sessionProjectMounts: { [SESSION]: [mount] },
      loadDiffComments: async () => undefined,
      assignDiffComment: assign,
    });
    render(<UnassignedNotes sessionId={SESSION} />);
    screen.getByText('Cast the ledger id in a');
    screen.getByText('Link the export from the page header');
    expect(screen.queryByText('Cast the ledger id in b')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Move to feat/export' })[0]!);
    expect(assign).toHaveBeenCalledWith(SESSION, 'a');
  });
});
