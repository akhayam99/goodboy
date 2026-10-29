// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  PullRequestState,
  SessionExternalTask,
  SessionId,
  ProjectId,
  WorkspaceId,
} from '@goodboy/types';

type GhRun = (
  args: ReadonlyArray<string>,
  opts: Readonly<Record<string, unknown>>,
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

const h = vi.hoisted(() => ({
  run: vi.fn<GhRun>(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
  upsertMountPullRequestLink: vi.fn(async () => true),
  findPrSeriesMembership: vi.fn(async (): Promise<unknown> => null),
  remotes: vi.fn<() => ReadonlyArray<string>>(() => ['origin']),
}));

vi.mock('../../../shared/lib/invokeCommand', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/lib/invokeCommand')>()),
  invokeCommand: vi.fn(async (name: string) => {
    if (name === 'git_remote_names') {
      return h.remotes();
    }
    throw new Error(`unmocked command ${name}`);
  }),
}));

vi.mock('../../../features/integrations/github/github', () => ({
  tauriGhRunner: { run: h.run },
}));

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: {},
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    upsertMountPullRequestLink: h.upsertMountPullRequestLink,
    findPrSeriesMembership: h.findPrSeriesMembership,
  }),
);

import { createPrForSession } from './createPrForSession';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'sess-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const PROJECT_ID = 'project-1' as ProjectId;
const OTHER_PROJECT_ID = 'project-2' as ProjectId;
const MOUNT_ID = 'mount-1' as MountId;
const OTHER_MOUNT_ID = 'mount-2' as MountId;
const BRANCH = 'ak/cards';
const OTHER_BRANCH = 'ak/cards-part-two';
const NOW = '2026-08-04T00:00:00.000Z' as IsoDateTime;
const CREATED_URL = 'https://github.com/acme/web/pull/7';

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

type MountParams = {
  readonly id: MountId;
  readonly projectId: ProjectId;
  readonly branch: string;
  readonly worktreePath: string;
  readonly baseBranch?: string;
};

const mountView = ({
  id,
  projectId,
  branch,
  worktreePath,
  baseBranch = 'main',
}: MountParams): unknown => ({
  id,
  sessionId: SESSION_ID,
  projectId,
  mountName: 'repo',
  worktreePath,
  lastWorktreePath: worktreePath,
  repoRoot: '/repo',
  branch,
  baseBranch,
  parallelIndex: 0,
  repoSlug: 'acme/web',
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: NOW,
  updatedAt: NOW,
});

type FakeState = {
  sessions: ReadonlyArray<unknown>;
  workspaces: ReadonlyArray<unknown>;
  projects: ReadonlyArray<unknown>;
  sessionProjectMounts: Record<string, ReadonlyArray<unknown>>;
  sessionMounts: Record<string, ReadonlyArray<unknown>>;
  sessionActiveMount: Record<string, MountId | null>;
  sessionActiveProject: Record<string, string>;
  sessionExternalTasks: Record<string, ReadonlyArray<SessionExternalTask>>;
  mountGithub: Record<string, { pr: PullRequestState | null }>;
  scribeWork: Record<string, { status: string }>;
  refreshSessionPr: ReturnType<typeof vi.fn>;
  editPr: ReturnType<typeof vi.fn>;
  emitNotification: ReturnType<typeof vi.fn>;
  recordSessionEventOnce: ReturnType<typeof vi.fn>;
  pushBranch: ReturnType<typeof vi.fn>;
};

const buildState = (overrides: Partial<FakeState> = {}): FakeState => ({
  sessions: [
    {
      id: SESSION_ID,
      workspaceId: WORKSPACE_ID,
      activeProjectId: PROJECT_ID,
      activeMountId: MOUNT_ID,
      goal: 'Fix the cards',
    },
  ],
  workspaces: [{ id: WORKSPACE_ID }],
  projects: [
    { id: PROJECT_ID, workspaceId: WORKSPACE_ID, rootPath: '/repo', kind: 'repo' },
    { id: OTHER_PROJECT_ID, workspaceId: WORKSPACE_ID, rootPath: '/repo', kind: 'repo' },
  ],
  sessionProjectMounts: {},
  sessionMounts: {
    [SESSION_ID]: [
      mountView({
        id: MOUNT_ID,
        projectId: PROJECT_ID,
        branch: BRANCH,
        worktreePath: '/repo/.goodboy/worktrees/cards',
      }),
      mountView({
        id: OTHER_MOUNT_ID,
        projectId: OTHER_PROJECT_ID,
        branch: OTHER_BRANCH,
        worktreePath: '/repo/.goodboy/worktrees/cards-2',
      }),
    ],
  },
  sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
  sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
  sessionExternalTasks: {},
  mountGithub: {},
  scribeWork: {},
  refreshSessionPr: vi.fn(async () => undefined),
  editPr: vi.fn(async () => undefined),
  emitNotification: vi.fn(async () => undefined),
  recordSessionEventOnce: vi.fn(async () => undefined),
  pushBranch: vi.fn(async () => ({ ok: true })),
  ...overrides,
});

const buildCreate = (state: FakeState) => {
  const set = vi.fn() as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  return createPrForSession(set, get);
};

const createArgs = (): ReadonlyArray<string> => h.run.mock.calls[0]![0];

const createOpts = (): Readonly<Record<string, unknown>> => h.run.mock.calls[0]![1];

const bodyArg = (): string => {
  const args = createArgs();
  return args[args.indexOf('--body') + 1] ?? '';
};

beforeEach(() => {
  h.run.mockClear();
  h.upsertMountPullRequestLink.mockClear();
  h.findPrSeriesMembership.mockReset();
  h.findPrSeriesMembership.mockResolvedValue(null);
  h.remotes.mockReturnValue(['origin']);
  h.run.mockImplementation(async () => ({ stdout: `${CREATED_URL}\n`, stderr: '', exitCode: 0 }));
});

describe('createPrForSession, issue references', () => {
  it('closes the github issue linked on the session branch', async () => {
    const state = buildState({
      sessionExternalTasks: { [SESSION_ID]: [githubIssue()] },
    });

    await buildCreate(state)({
      sessionId: SESSION_ID,
      title: 'Fix cards',
      body: 'Documents the change.',
    });

    expect(bodyArg()).toBe('Documents the change.\n\nCloses #41');
  });

  it('writes Part of, never Closes, for a link told not to close', async () => {
    const state = buildState({
      sessionExternalTasks: {
        [SESSION_ID]: [
          githubIssue({ relation: 'part-of' }),
          githubIssue({ externalId: '52', identifier: '#52', scope: 'branch' }),
        ],
      },
    });

    await buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: 'First part.' });

    expect(bodyArg()).toBe('First part.\n\nCloses #52\nPart of #41');
    expect(bodyArg()).not.toContain('Closes #41');
  });

  it('closes every github issue linked on the session branch', async () => {
    const state = buildState({
      sessionExternalTasks: {
        [SESSION_ID]: [githubIssue(), githubIssue({ externalId: '52', identifier: '#52' })],
      },
    });

    await buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: '' });

    expect(bodyArg()).toBe('Closes #41\nCloses #52');
  });

  it('leaves out an issue linked on another branch', async () => {
    const state = buildState({
      sessionExternalTasks: {
        [SESSION_ID]: [githubIssue({ branch: 'ak/somewhere-else' })],
      },
    });

    await buildCreate(state)({
      sessionId: SESSION_ID,
      title: 'Fix cards',
      body: 'Documents the change.',
    });

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

    await buildCreate(state)({
      sessionId: SESSION_ID,
      title: 'Fix cards',
      body: 'Documents the change.',
    });

    expect(bodyArg()).toBe('Documents the change.');
    expect(createArgs()).not.toContain('--fill');
  });

  it('leaves every reference out when the caller asks for none', async () => {
    const state = buildState({
      sessionExternalTasks: { [SESSION_ID]: [githubIssue()] },
    });

    await buildCreate(state)({
      sessionId: SESSION_ID,
      title: 'Fix cards',
      body: 'Documents the change.',
      referenceMode: 'none',
    });

    expect(bodyArg()).toBe('Documents the change.');
  });

  it('patches the body gh generated with --fill so the reference still lands', async () => {
    const created = { number: 7, body: 'Generated from the commits.' } as PullRequestState;
    const state = buildState({
      sessionExternalTasks: { [SESSION_ID]: [githubIssue()] },
      mountGithub: { [MOUNT_ID]: { pr: created } },
    });

    await buildCreate(state)({ sessionId: SESSION_ID });

    expect(createArgs()).toContain('--fill');
    expect(state.editPr).toHaveBeenCalledWith(SESSION_ID, 7, {
      body: 'Generated from the commits.\n\nCloses #41',
      mountId: MOUNT_ID,
    });
  });

  it('names the cause when the reference patch fails instead of dropping it', async () => {
    const created = { number: 7, body: 'Generated from the commits.' } as PullRequestState;
    const state = buildState({
      sessionExternalTasks: { [SESSION_ID]: [githubIssue()] },
      mountGithub: { [MOUNT_ID]: { pr: created } },
    });
    state.editPr.mockRejectedValueOnce(new Error('gh: pull request is locked'));

    await buildCreate(state)({ sessionId: SESSION_ID });

    const warning = state.emitNotification.mock.calls
      .map((call: ReadonlyArray<{ title: string; body?: string }>) => call[0])
      .find((params?: { title: string }) => params?.title === 'PR opened without its issue links');
    expect(warning?.body).toContain('Closes #41');
    expect(warning?.body).toContain('gh: pull request is locked');
  });

  it('does not patch a filled body that already closes the issue', async () => {
    const created = { number: 7, body: 'fix #41' } as PullRequestState;
    const state = buildState({
      sessionExternalTasks: { [SESSION_ID]: [githubIssue()] },
      mountGithub: { [MOUNT_ID]: { pr: created } },
    });

    await buildCreate(state)({ sessionId: SESSION_ID });

    expect(state.editPr).not.toHaveBeenCalled();
  });
});

describe('createPrForSession, mount targeting', () => {
  it('creates from the worktree cwd with an explicit repository and head branch', async () => {
    const state = buildState();

    await buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: '' });

    const args = createArgs();
    expect(args.slice(0, 6)).toEqual(['pr', 'create', '--repo', 'acme/web', '--head', BRANCH]);
    expect(createOpts()).toMatchObject({ cwd: '/repo/.goodboy/worktrees/cards' });
  });

  it('creates for a mount that is not the active one', async () => {
    const state = buildState();

    await buildCreate(state)({
      sessionId: SESSION_ID,
      mountId: OTHER_MOUNT_ID,
      title: 'Part two',
      body: '',
    });

    expect(createArgs()).toContain(OTHER_BRANCH);
    expect(createOpts()).toMatchObject({
      cwd: '/repo/.goodboy/worktrees/cards-2',
      projectId: OTHER_PROJECT_ID,
    });
  });

  it('persists the created request identity before any refresh', async () => {
    const state = buildState();

    await buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: '' });

    expect(h.upsertMountPullRequestLink).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        link: expect.objectContaining({
          mountId: MOUNT_ID,
          provider: 'github',
          host: 'github.com',
          repoSlug: 'acme/web',
          prNumber: 7,
          headBranch: BRANCH,
        }),
      }),
    );
    expect(state.recordSessionEventOnce).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pr_created' }),
    );
  });

  it('captures the base branch of the mount when the caller gives none', async () => {
    const state = buildState();

    await buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: '' });

    const args = createArgs();
    expect(args[args.indexOf('--base') + 1]).toBe('main');
  });

  const stateWithBase = (baseBranch: string): FakeState =>
    buildState({
      sessionMounts: {
        [SESSION_ID]: [
          mountView({
            id: MOUNT_ID,
            projectId: PROJECT_ID,
            branch: BRANCH,
            worktreePath: '/repo/.goodboy/worktrees/cards',
            baseBranch,
          }),
        ],
      },
    });

  it('sends the branch name, never the remote tracking ref, when the mount stores origin/main', async () => {
    const state = stateWithBase('origin/main');

    await buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: '' });

    const args = createArgs();
    expect(args[args.indexOf('--base') + 1]).toBe('main');
    expect(h.upsertMountPullRequestLink).toHaveBeenCalledWith(
      expect.objectContaining({ link: expect.objectContaining({ baseBranch: 'main' }) }),
    );
  });

  it('strips the name of the remote the repository really has, not a fixed origin', async () => {
    h.remotes.mockReturnValue(['origin', 'upstream']);
    const state = stateWithBase('upstream/develop');

    await buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: '' });

    const args = createArgs();
    expect(args[args.indexOf('--base') + 1]).toBe('develop');
  });

  it('strips the remote off a base the caller typed', async () => {
    const state = buildState();

    await buildCreate(state)({
      sessionId: SESSION_ID,
      title: 'Fix cards',
      body: '',
      base: ' origin/release ',
    });

    const args = createArgs();
    expect(args[args.indexOf('--base') + 1]).toBe('release');
  });

  it('keeps a base branch whose name only looks like a remote path', async () => {
    const state = stateWithBase('release/2026');

    await buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: '' });

    const args = createArgs();
    expect(args[args.indexOf('--base') + 1]).toBe('release/2026');
  });
});

describe('createPrForSession, pushing the branch first', () => {
  it('pushes the mount branch before gh opens the request', async () => {
    const state = buildState();

    await buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: '' });

    expect(state.pushBranch).toHaveBeenCalledExactlyOnceWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      mode: 'plain',
    });
    expect(state.pushBranch.mock.invocationCallOrder[0]).toBeLessThan(
      h.run.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('force pushes with the online commits the person confirmed, never a plain push', async () => {
    const state = buildState();

    await buildCreate(state)({
      sessionId: SESSION_ID,
      title: 'Fix cards',
      body: '',
      forcePush: { confirmedOnlyOnline: ['b2c3d4e'] },
    });

    expect(state.pushBranch).toHaveBeenCalledExactlyOnceWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      mode: 'lease',
      guard: { kind: 'confirmed', confirmedOnlyOnline: ['b2c3d4e'], confirmedRemoteSha: null },
    });
    expect(state.pushBranch.mock.invocationCallOrder[0]).toBeLessThan(
      h.run.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('opens nothing when the force push is refused because origin moved after the confirm', async () => {
    const state = buildState({
      pushBranch: vi.fn(async () => ({
        ok: false,
        error: 'The online copy changed since you confirmed.',
        reason: 'moved',
      })),
    });

    await expect(
      buildCreate(state)({
        sessionId: SESSION_ID,
        title: 'Fix cards',
        body: '',
        forcePush: { confirmedOnlyOnline: [] },
      }),
    ).rejects.toThrow("Couldn't push ak/cards: The online copy changed since you confirmed.");

    expect(h.run).not.toHaveBeenCalled();
    expect(h.upsertMountPullRequestLink).not.toHaveBeenCalled();
  });

  it('pushes the branch of the mount asked for, not the active one', async () => {
    const state = buildState();

    await buildCreate(state)({
      sessionId: SESSION_ID,
      mountId: OTHER_MOUNT_ID,
      title: 'Part two',
      body: '',
    });

    expect(state.pushBranch).toHaveBeenCalledExactlyOnceWith({
      sessionId: SESSION_ID,
      mountId: OTHER_MOUNT_ID,
      mode: 'plain',
    });
  });

  it('stops with the push reason and tells the user when the push is refused', async () => {
    const state = buildState({
      pushBranch: vi.fn(async () => ({
        ok: false,
        error: 'remote: Permission to acme/web.git denied',
        reason: 'failed',
      })),
    });

    await expect(
      buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: '' }),
    ).rejects.toThrow("Couldn't push ak/cards: remote: Permission to acme/web.git denied");

    expect(h.run).not.toHaveBeenCalled();
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't push the branch",
        body: 'remote: Permission to acme/web.git denied',
      }),
    );
  });

  it('hands back the number and address of the request it opened', async () => {
    const state = buildState();

    await expect(
      buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: '' }),
    ).resolves.toEqual({ number: 7, url: CREATED_URL });
  });
});

const membership = (overrides: Record<string, unknown> = {}): unknown => ({
  series: {
    id: 'series-1',
    sessionId: SESSION_ID,
    projectId: PROJECT_ID,
    name: 'restyle',
    workItemIdentifier: 'ENG-3240',
    workItemUrl: null,
    plannedCount: 6,
    parentRequest: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...((overrides['series'] as Record<string, unknown>) ?? {}),
  },
  member: {
    id: 'member-3',
    seriesId: 'series-1',
    mountId: MOUNT_ID,
    branch: BRANCH,
    ordinal: 3,
    label: '3/6',
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    ...((overrides['member'] as Record<string, unknown>) ?? {}),
  },
});

describe('createPrForSession, series members', () => {
  it('never closes the work item when the branch is one part of a series', async () => {
    h.findPrSeriesMembership.mockResolvedValue(membership());
    const state = buildState({
      sessionExternalTasks: { [SESSION_ID]: [githubIssue()] },
    });

    await buildCreate(state)({
      sessionId: SESSION_ID,
      title: 'Patient header',
      body: 'Splits the header out.',
    });

    expect(bodyArg()).not.toContain('Closes #41');
    expect(bodyArg()).toContain('Part of ENG-3240');
  });

  it('writes the ordered position of the member under its series name', async () => {
    h.findPrSeriesMembership.mockResolvedValue(membership());
    const state = buildState();

    await buildCreate(state)({
      sessionId: SESSION_ID,
      title: 'Patient header',
      body: 'Splits the header out.',
    });

    expect(bodyArg()).toBe('Splits the header out.\n\nPart of ENG-3240\nrestyle 3/6');
  });

  it('leaves a body that already names the work item and the position untouched', async () => {
    h.findPrSeriesMembership.mockResolvedValue(membership());
    const state = buildState();

    await buildCreate(state)({
      sessionId: SESSION_ID,
      title: 'Patient header',
      body: 'Built on main, not stacked. Part of ENG-3240, restyle 3/6.',
    });

    expect(bodyArg()).toBe('Built on main, not stacked. Part of ENG-3240, restyle 3/6.');
  });

  it('closes the issue again once the caller asks for closing references explicitly', async () => {
    h.findPrSeriesMembership.mockResolvedValue(membership());
    const state = buildState({
      sessionExternalTasks: { [SESSION_ID]: [githubIssue()] },
    });

    await buildCreate(state)({
      sessionId: SESSION_ID,
      title: 'Patient header',
      body: 'Last part.',
      referenceMode: 'closing',
    });

    expect(bodyArg()).toBe('Last part.\n\nCloses #41');
  });

  it('never rewrites a generated body of a series member after creation', async () => {
    h.findPrSeriesMembership.mockResolvedValue(membership());
    const created = { number: 7, body: 'Generated from the commits.' } as PullRequestState;
    const state = buildState({
      sessionExternalTasks: { [SESSION_ID]: [githubIssue()] },
      mountGithub: { [MOUNT_ID]: { pr: created } },
    });

    await buildCreate(state)({ sessionId: SESSION_ID });

    expect(createArgs()).toContain('--fill');
    expect(state.editPr).not.toHaveBeenCalled();
  });
});

describe('createPrForSession, while Scribe writes', () => {
  it.each(['writing', 'creating'])(
    'refuses on the same mount while the job is %s, with no push and no gh call',
    async (status) => {
      const state = buildState({ scribeWork: { [`pr:${MOUNT_ID}`]: { status } } });

      await expect(
        buildCreate(state)({
          sessionId: SESSION_ID,
          mountId: MOUNT_ID,
          title: 'Fix cards',
          body: '',
        }),
      ).rejects.toThrow('Scribe is still writing the text.');

      expect(state.pushBranch).not.toHaveBeenCalled();
      expect(h.run).not.toHaveBeenCalled();
      expect(h.upsertMountPullRequestLink).not.toHaveBeenCalled();
    },
  );

  it('refuses when Scribe starts writing while the branch is being pushed', async () => {
    const state = buildState();
    state.pushBranch = vi.fn(async () => {
      state.scribeWork = { [`pr:${MOUNT_ID}`]: { status: 'writing' } };
      return { ok: true };
    });

    await expect(
      buildCreate(state)({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        title: 'Fix cards',
        body: '',
      }),
    ).rejects.toThrow('Scribe is still writing the text.');

    expect(state.pushBranch).toHaveBeenCalledTimes(1);
    expect(h.run).not.toHaveBeenCalled();
    expect(h.upsertMountPullRequestLink).not.toHaveBeenCalled();
  });

  it('lets Scribe open its own pull request while its job is creating', async () => {
    const state = buildState({ scribeWork: { [`pr:${MOUNT_ID}`]: { status: 'creating' } } });

    await buildCreate(state)({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      title: 'Fix cards',
      body: 'Written by Scribe.',
      isScribeBody: true,
    });

    expect(state.pushBranch).toHaveBeenCalledTimes(1);
    expect(h.run).toHaveBeenCalledTimes(1);
  });

  it('opens when the job of another mount is the one writing', async () => {
    const state = buildState({ scribeWork: { [`pr:${OTHER_MOUNT_ID}`]: { status: 'writing' } } });

    await buildCreate(state)({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      title: 'Fix cards',
      body: '',
    });

    expect(h.run).toHaveBeenCalledTimes(1);
  });

  it.each(['ready', 'failed', 'created'])('opens once the job is %s', async (status) => {
    const state = buildState({ scribeWork: { [`pr:${MOUNT_ID}`]: { status } } });

    await buildCreate(state)({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      title: 'Fix cards',
      body: '',
    });

    expect(h.run).toHaveBeenCalledTimes(1);
  });
});

describe('createPrForSession, a create whose outcome was uncertain', () => {
  const ALREADY_EXISTS = [
    'a pull request for branch "ak/cards" into branch "main" already exists:',
    CREATED_URL,
  ].join('\n');

  const create = (state: FakeState) =>
    buildCreate(state)({ sessionId: SESSION_ID, title: 'Fix cards', body: '' });

  it('returns the opened number with a warning when the link could not be saved', async () => {
    const state = buildState();
    h.upsertMountPullRequestLink.mockRejectedValueOnce(new Error('database is locked'));

    const created = await create(state);

    expect(created).toEqual({ number: 7, url: CREATED_URL });
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warning',
        title: 'Opened #7, but Goodboy could not save the link',
      }),
    );
    expect(state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      force: true,
      mountId: MOUNT_ID,
    });
  });

  it('returns the opened number with a warning when the event could not be recorded', async () => {
    const state = buildState({
      recordSessionEventOnce: vi.fn(async () => {
        throw new Error('database is locked');
      }),
    });

    const created = await create(state);

    expect(created.number).toBe(7);
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warning' }),
    );
  });

  it('adopts the request that already exists on the retry instead of opening a second', async () => {
    const state = buildState();
    h.upsertMountPullRequestLink.mockRejectedValueOnce(new Error('database is locked'));
    await create(state);
    h.run.mockResolvedValueOnce({ stdout: '', stderr: ALREADY_EXISTS, exitCode: 1 });

    const retried = await create(state);

    expect(retried).toEqual({ number: 7, url: CREATED_URL });
    expect(h.upsertMountPullRequestLink).toHaveBeenCalledTimes(2);
    expect(state.emitNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't create the pull request" }),
    );
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Linked the existing pull request for Fix the cards' }),
    );
  });

  it('adopts a request someone else opened since the form was filled', async () => {
    const state = buildState();
    h.run.mockResolvedValueOnce({ stdout: '', stderr: ALREADY_EXISTS, exitCode: 1 });

    const created = await create(state);

    expect(created).toEqual({ number: 7, url: CREATED_URL });
    expect(h.upsertMountPullRequestLink).toHaveBeenCalledTimes(1);
  });

  it('does not record an adopted request as a draft from the new request flag', async () => {
    const state = buildState();
    h.run.mockResolvedValueOnce({ stdout: '', stderr: ALREADY_EXISTS, exitCode: 1 });

    await buildCreate(state)({
      sessionId: SESSION_ID,
      title: 'Fix cards',
      body: '',
      draft: true,
    });

    expect(h.upsertMountPullRequestLink).toHaveBeenCalledWith(
      expect.objectContaining({ link: expect.objectContaining({ state: 'open' }) }),
    );
  });

  it('still fails with the host line when the refusal is not an existing request', async () => {
    const state = buildState();
    h.run.mockResolvedValueOnce({
      stdout: '',
      stderr: 'GraphQL: Resource not accessible',
      exitCode: 1,
    });

    await expect(create(state)).rejects.toThrow('GraphQL: Resource not accessible');

    expect(h.upsertMountPullRequestLink).not.toHaveBeenCalled();
  });

  it('tells the user the branch is missing from GitHub instead of the GraphQL list', async () => {
    const state = buildState();
    h.run.mockResolvedValueOnce({
      stdout: '',
      stderr:
        "pull request create failed: GraphQL: Head sha can't be blank, No commits between main and ak/cards (createPullRequest)",
      exitCode: 1,
    });

    await expect(create(state)).rejects.toThrow(
      "Couldn't open the pull request: the branch isn't on GitHub yet. Push it and retry.",
    );

    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Couldn't open the pull request: the branch isn't on GitHub yet. Push it and retry.",
      }),
    );
  });

  it('opens once after a push that went through and a create that did not', async () => {
    const state = buildState();
    h.run.mockResolvedValueOnce({ stdout: '', stderr: 'network is down', exitCode: 1 });

    await expect(create(state)).rejects.toThrow('network is down');
    const retried = await create(state);

    expect(retried.number).toBe(7);
    expect(state.pushBranch).toHaveBeenCalledTimes(2);
    expect(h.upsertMountPullRequestLink).toHaveBeenCalledTimes(1);
  });
});
