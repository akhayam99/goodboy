import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  PullRequestState,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

type GhRun = (
  args: ReadonlyArray<string>,
  opts: Readonly<Record<string, unknown>>,
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

const h = vi.hoisted(() => ({
  run: vi.fn<GhRun>(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
}));

vi.mock('../../../features/github/github', () => ({
  tauriGhRunner: { run: h.run },
}));

import { createPrForSession } from './createPrForSession';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'sess-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const BRANCH = 'ak/cards';
const NOW = '2026-08-04T00:00:00.000Z' as IsoDateTime;

const githubIssue = (overrides: Partial<SessionExternalTask> = {}): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider: 'github',
  externalId: '41',
  identifier: '#41',
  url: 'https://github.com/acme/web/issues/41',
  title: 'Broken card',
  branch: BRANCH,
  createdAt: NOW,
  ...overrides,
});

type FakeState = {
  sessions: ReadonlyArray<unknown>;
  workspaces: ReadonlyArray<unknown>;
  sessionBranches: Record<string, string>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  sessionMounts: Record<string, ReadonlyArray<unknown>>;
  sessionActiveMount: Record<string, string>;
  sessionExternalTasks: Record<string, ReadonlyArray<SessionExternalTask>>;
  sessionGithub: Record<string, { pr: PullRequestState | null }>;
  refreshSessionPr: ReturnType<typeof vi.fn>;
  editPr: ReturnType<typeof vi.fn>;
  emitNotification: ReturnType<typeof vi.fn>;
};

const buildState = (overrides: Partial<FakeState> = {}): FakeState => ({
  sessions: [{ id: SESSION_ID, workspaceId: WORKSPACE_ID, goal: 'Fix the cards' }],
  workspaces: [{ id: WORKSPACE_ID, rootPath: '/repo', kind: 'repo' }],
  sessionBranches: { [SESSION_ID]: BRANCH },
  sessionWorktrees: { [SESSION_ID]: ['/repo/.goodboy/worktrees/cards'] },
  sessionMounts: {},
  sessionActiveMount: {},
  sessionExternalTasks: {},
  sessionGithub: {},
  refreshSessionPr: vi.fn(async () => undefined),
  editPr: vi.fn(async () => undefined),
  emitNotification: vi.fn(async () => undefined),
  ...overrides,
});

const buildCreate = (state: FakeState) => {
  const set = vi.fn() as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  return createPrForSession(set, get);
};

const bodyArg = (): string => {
  const args = h.run.mock.calls[0]![0];
  return args[args.indexOf('--body') + 1] ?? '';
};

beforeEach(() => {
  h.run.mockClear();
  h.run.mockImplementation(async () => ({ stdout: '', stderr: '', exitCode: 0 }));
});

describe('createPrForSession, issue references', () => {
  it('closes the github issue linked on the session branch', async () => {
    const state = buildState({
      sessionExternalTasks: { [SESSION_ID]: [githubIssue()] },
    });

    await buildCreate(state)(SESSION_ID, { title: 'Fix cards', body: 'Documents the change.' });

    expect(bodyArg()).toBe('Documents the change.\n\nCloses #41');
  });

  it('closes every github issue linked on the session branch', async () => {
    const state = buildState({
      sessionExternalTasks: {
        [SESSION_ID]: [githubIssue(), githubIssue({ externalId: '52', identifier: '#52' })],
      },
    });

    await buildCreate(state)(SESSION_ID, { title: 'Fix cards', body: '' });

    expect(bodyArg()).toBe('Closes #41\nCloses #52');
  });

  it('leaves out an issue linked on another branch', async () => {
    const state = buildState({
      sessionExternalTasks: {
        [SESSION_ID]: [githubIssue({ branch: 'ak/somewhere-else' })],
      },
    });

    await buildCreate(state)(SESSION_ID, { title: 'Fix cards', body: 'Documents the change.' });

    expect(bodyArg()).toBe('Documents the change.');
  });

  it('never writes a linear issue as a closing reference', async () => {
    const state = buildState({
      sessionExternalTasks: {
        [SESSION_ID]: [
          githubIssue({ provider: 'linear', externalId: 'GRO-12', identifier: 'GRO-12' }),
        ],
      },
    });

    await buildCreate(state)(SESSION_ID, { title: 'Fix cards', body: 'Documents the change.' });

    expect(bodyArg()).toBe('Documents the change.');
    expect(h.run.mock.calls[0]![0]).not.toContain('--fill');
  });

  it('patches the body gh generated with --fill so the reference still lands', async () => {
    const created = {
      number: 7,
      body: 'Generated from the commits.',
    } as PullRequestState;
    const state = buildState({
      sessionExternalTasks: { [SESSION_ID]: [githubIssue()] },
      sessionGithub: { [SESSION_ID]: { pr: created } },
    });

    await buildCreate(state)(SESSION_ID);

    expect(h.run.mock.calls[0]![0]).toContain('--fill');
    expect(state.editPr).toHaveBeenCalledWith(SESSION_ID, 7, {
      body: 'Generated from the commits.\n\nCloses #41',
    });
  });

  it('does not patch a filled body that already closes the issue', async () => {
    const created = { number: 7, body: 'fix #41' } as PullRequestState;
    const state = buildState({
      sessionExternalTasks: { [SESSION_ID]: [githubIssue()] },
      sessionGithub: { [SESSION_ID]: { pr: created } },
    });

    await buildCreate(state)(SESSION_ID);

    expect(state.editPr).not.toHaveBeenCalled();
  });
});
