// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
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
import { useBranchNotes } from './index';

const SESSION = 'session-ledger-export' as SessionId;
const PROJECT = 'project-payments-api' as ProjectId;

const note = (id: string, target?: { projectId: ProjectId; branch: string }): DiffComment => ({
  id,
  sessionId: SESSION,
  filePath: 'src/ledger.ts',
  body: `Note ${id}`,
  status: 'open',
  createdAt: '2026-10-01T10:00:00.000Z' as IsoDateTime,
  authorKind: 'user',
  ...target,
});

const mount = (branch: string): SessionProjectMount => ({
  mountId: 'mount-a' as MountId,
  sessionId: SESSION,
  projectId: PROJECT,
  mountName: 'payments-api',
  worktreePath: '/wt/payments-api',
  lastWorktreePath: null,
  repoRoot: '/repo/payments-api',
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    diffComments: {
      [SESSION]: [
        note('here', { projectId: PROJECT, branch: 'feat/export' }),
        note('elsewhere', { projectId: PROJECT, branch: 'feat/other' }),
        note('old'),
      ],
    },
    sessionProjectMounts: { [SESSION]: [mount('feat/export')] },
  });
});

afterEach(cleanup);

describe('useBranchNotes', () => {
  it('keeps the notes of the active branch and lists the unassigned ones apart', () => {
    const { result } = renderHook(() => useBranchNotes({ sessionId: SESSION }));
    expect(result.current.onBranch.map((entry) => entry.id)).toEqual(['here']);
    expect(result.current.unassigned.map((entry) => entry.id)).toEqual(['old']);
    expect(result.current.all).toHaveLength(3);
  });

  it('follows the branch of the mount', () => {
    useAppStore.setState({ sessionProjectMounts: { [SESSION]: [mount('feat/other')] } });
    const { result } = renderHook(() => useBranchNotes({ sessionId: SESSION }));
    expect(result.current.onBranch.map((entry) => entry.id)).toEqual(['elsewhere']);
  });

  it('shows every note when the session has no mount to scope by', () => {
    useAppStore.setState({ sessionProjectMounts: { [SESSION]: [] } });
    const { result } = renderHook(() => useBranchNotes({ sessionId: SESSION }));
    expect(result.current.onBranch).toHaveLength(3);
  });
});
