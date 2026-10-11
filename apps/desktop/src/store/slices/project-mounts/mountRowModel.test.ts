// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  PullRequestStateKind,
  SessionId,
  SessionMountView,
  WorkspaceId,
  WorktreeStatus,
} from '@goodboy/types';
import type { MountGithubState } from '../../types';
import {
  buildMountRows,
  classifyMountRows,
  isMountCompleted,
  isMountRequestMerged,
  type MountRowState,
} from './mountRowModel';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-1' as ProjectId;
const FIRST = 'mount-1' as MountId;
const SECOND = 'mount-2' as MountId;
const THIRD = 'mount-3' as MountId;
const NOW = '2026-01-01T00:00:00.000Z' as IsoDateTime;

type ViewParams = {
  readonly id: MountId;
  readonly branch: string;
  readonly worktreePath: string | null;
  readonly parallelIndex: number;
};

const mountView = ({ id, branch, worktreePath, parallelIndex }: ViewParams): SessionMountView => ({
  id,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  worktreePath,
  lastWorktreePath: worktreePath,
  branch,
  baseBranch: 'main',
  parallelIndex,
  mountName: 'ledger-core',
  repoSlug: null,
  repoRoot: '/repos/ledger-core',
  isAttached: worktreePath !== null,
  diskState: worktreePath === null ? 'missing' : 'present',
  revision: 1,
  createdAt: NOW,
  updatedAt: NOW,
});

const PROJECT: Project = {
  id: PROJECT_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'ledger-core',
  rootPath: '/repos/ledger-core',
  kind: 'repo',
  overrides: {
    defaultProviderId: null,
    defaultBranchPrefix: null,
    defaultVerbosity: null,
    providerBindings: null,
    taskModels: null,
    roleModels: null,
    parallelAgents: null,
    providerPool: null,
    attributionFooter: null,
    replyVoice: null,
    replyStyleNote: null,
    replyTemplateFixed: null,
    replyTemplateNoChange: null,
    resolveOnGithub: null,
    resolveCommitStyle: null,
    afterMerge: null,
    defaultBranchTemplate: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
};

type GithubStateParams = {
  readonly mountId: MountId;
  readonly state: PullRequestStateKind;
};

const githubState = ({ mountId, state }: GithubStateParams): MountGithubState => {
  const pr = {
    number: mountId === FIRST ? 11 : mountId === SECOND ? 12 : 13,
    title: `Request for ${mountId}`,
    url: `https://github.com/acme/ledger-core/pull/${mountId}`,
    state,
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: `ak/${mountId}`,
    isDraft: false,
    reviewDecision: 'approved',
    body: '',
    updatedAt: NOW,
    headSha: `sha-${mountId}`,
  } satisfies NonNullable<MountGithubState['pr']>;
  return {
    mountId,
    projectId: PROJECT_ID,
    revision: 1,
    repository: 'acme/ledger-core',
    host: 'github.com',
    branch: pr.headBranch,
    prs: [pr],
    links: [],
    pr,
    linkedIssues: [],
    fetchedAt: NOW,
    failedAt: null,
    loading: false,
    error: null,
    detail: null,
    detailFetchedAt: null,
    detailLoading: false,
    detailError: null,
  };
};

const makeState = (): MountRowState => ({
  projects: [PROJECT],
  sessionMounts: {
    [SESSION_ID]: [
      mountView({ id: FIRST, branch: 'ak/part-one', worktreePath: '/wt/one', parallelIndex: 0 }),
      mountView({ id: SECOND, branch: 'ak/part-two', worktreePath: '/wt/two', parallelIndex: 1 }),
    ],
  },
  sessionProjectMounts: {},
  mountGithub: {},
  mountGitlabMr: {},
  mountBitbucketPr: {},
  mountBranchObservations: {
    [SESSION_ID]: [
      {
        mountId: FIRST,
        sessionId: SESSION_ID,
        state: 'mismatch',
        recordedBranch: 'ak/part-one',
        observedBranch: 'ak/part-two',
        revision: 1,
        observedAt: NOW,
      },
    ],
  },
  prSeries: {},
});

describe('buildMountRows', () => {
  it('uses the shared completion predicate for merged, closed, and open requests', () => {
    const state: MountRowState = {
      ...makeState(),
      sessionMounts: {
        [SESSION_ID]: [
          mountView({
            id: FIRST,
            branch: 'ak/part-one',
            worktreePath: '/wt/one',
            parallelIndex: 0,
          }),
          mountView({
            id: SECOND,
            branch: 'ak/part-two',
            worktreePath: '/wt/two',
            parallelIndex: 1,
          }),
          mountView({
            id: THIRD,
            branch: 'ak/part-three',
            worktreePath: '/wt/three',
            parallelIndex: 2,
          }),
        ],
      },
      mountGithub: {
        [FIRST]: githubState({ mountId: FIRST, state: 'merged' }),
        [SECOND]: githubState({ mountId: SECOND, state: 'closed' }),
        [THIRD]: githubState({ mountId: THIRD, state: 'open' }),
      },
    };
    const [group] = buildMountRows({ state, sessionId: SESSION_ID });
    const rows = [...(group?.rows ?? []), ...(group?.finishedRows ?? [])];

    expect(
      [FIRST, SECOND, THIRD].map((mountId) => ({
        mountId,
        predicate: isMountCompleted({ state, mountId }),
        row: rows.find((candidate) => candidate.mountId === mountId)?.isFinished,
      })),
    ).toEqual([
      { mountId: FIRST, predicate: true, row: true },
      { mountId: SECOND, predicate: true, row: true },
      { mountId: THIRD, predicate: false, row: false },
    ]);
    expect(
      [FIRST, SECOND, THIRD].map((mountId) => isMountRequestMerged({ state, mountId })),
    ).toEqual([true, false, false]);
    expect(rows.find((row) => row.mountId === FIRST)?.request?.mergedHeadSha).toBe(`sha-${FIRST}`);
    expect(rows.find((row) => row.mountId === THIRD)?.request?.mergedHeadSha).toBeNull();
  });

  it('names the mount that already holds the observed branch', () => {
    const [group] = buildMountRows({ state: makeState(), sessionId: SESSION_ID });
    const row = group?.rows.find((candidate) => candidate.mountId === FIRST);

    expect(row?.observedBranchHolder).toEqual({ mountId: SECOND, label: null });
  });

  it('leaves the holder empty when no other mount is on the observed branch', () => {
    const state = makeState();
    const views = state.sessionMounts[SESSION_ID] ?? [];
    const [first] = views;
    const rebuilt: MountRowState = {
      ...state,
      sessionMounts: {
        [SESSION_ID]: [
          ...(first === undefined ? [] : [first]),
          mountView({
            id: SECOND,
            branch: 'ak/part-three',
            worktreePath: '/wt/two',
            parallelIndex: 1,
          }),
        ],
      },
    };

    const [group] = buildMountRows({ state: rebuilt, sessionId: SESSION_ID });
    const row = group?.rows.find((candidate) => candidate.mountId === FIRST);

    expect(row?.observedBranchHolder).toBeNull();
  });
});

describe('buildMountRows checkout kind', () => {
  it('marks the row that lives in the repository root as the main checkout', () => {
    const state = makeState();
    const rebuilt: MountRowState = {
      ...state,
      sessionMounts: {
        [SESSION_ID]: [
          mountView({
            id: FIRST,
            branch: 'main',
            worktreePath: '/repos/ledger-core',
            parallelIndex: 0,
          }),
          mountView({
            id: SECOND,
            branch: 'ak/part-two',
            worktreePath: '/wt/two',
            parallelIndex: 1,
          }),
        ],
      },
    };

    const [group] = buildMountRows({ state: rebuilt, sessionId: SESSION_ID });

    expect(group?.rows.map((row) => [row.mountId, row.isMainCheckout])).toEqual([
      [FIRST, true],
      [SECOND, false],
    ]);
  });

  it('never calls a detached row the main checkout', () => {
    const state = makeState();
    const rebuilt: MountRowState = {
      ...state,
      sessionMounts: {
        [SESSION_ID]: [
          mountView({ id: FIRST, branch: 'main', worktreePath: null, parallelIndex: 0 }),
        ],
      },
    };

    const [group] = buildMountRows({ state: rebuilt, sessionId: SESSION_ID });

    expect(group?.rows[0]?.isMainCheckout).toBe(false);
  });
});

describe('classifyMountRows', () => {
  const BEHIND: WorktreeStatus = {
    branch: 'ak/part-one',
    head: 'aaaaaaa1',
    headSubject: 'work',
    upstream: 'origin/ak/part-one',
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    mainDistance: { kind: 'known', ahead: 3, behind: 2 },
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
    inProgress: null,
  };
  const AT_BASE: WorktreeStatus = {
    ...BEHIND,
    mainDistance: { kind: 'known', ahead: 0, behind: 0 },
  };

  const groupOf = (states: Readonly<Record<string, PullRequestStateKind>>) => {
    const ids = [FIRST, SECOND, THIRD];
    const state: MountRowState = {
      ...makeState(),
      mountBranchObservations: {},
      sessionMounts: {
        [SESSION_ID]: ids.map((id, index) =>
          mountView({
            id,
            branch: `ak/part-${index}`,
            worktreePath: `/wt/${index}`,
            parallelIndex: index,
          }),
        ),
      },
      mountGithub: Object.fromEntries(
        ids.flatMap((id) => {
          const requestState = states[id];
          return requestState === undefined
            ? []
            : [[id, githubState({ mountId: id, state: requestState })]];
        }),
      ),
    };
    const [group] = buildMountRows({ state, sessionId: SESSION_ID });
    if (group === undefined) {
      throw new Error('no group');
    }
    return group;
  };

  const idsOf = (rows: ReadonlyArray<{ readonly mountId: MountId }>): ReadonlyArray<string> =>
    rows.map((row) => row.mountId);

  it('keeps merged and closed requests in Finished before and after the status arrives', () => {
    const group = groupOf({ [FIRST]: 'merged', [SECOND]: 'closed', [THIRD]: 'open' });
    const none = () => null;
    const merged = () => null;

    const loading = classifyMountRows({ group, statusOf: none, commitsAfterMergeOf: none });
    const loaded = classifyMountRows({
      group,
      statusOf: () => BEHIND,
      commitsAfterMergeOf: merged,
    });

    expect(idsOf(loading.finished)).toEqual([FIRST, SECOND]);
    expect(idsOf(loaded.finished)).toEqual(idsOf(loading.finished));
    expect(idsOf(loaded.open)).toEqual(idsOf(loading.open));
    expect(idsOf(loaded.open)).toEqual([THIRD]);
  });

  it('never moves a row with an open request, whatever its status says', () => {
    const group = groupOf({ [FIRST]: 'open', [SECOND]: 'open', [THIRD]: 'open' });

    const atBase = classifyMountRows({
      group,
      statusOf: () => AT_BASE,
      commitsAfterMergeOf: () => null,
    });

    expect(idsOf(atBase.open)).toEqual([FIRST, SECOND, THIRD]);
    expect(atBase.finished).toEqual([]);
  });

  it('stays where the request puts a row without a request until its status says it landed', () => {
    const group = groupOf({});

    const loading = classifyMountRows({
      group,
      statusOf: () => null,
      commitsAfterMergeOf: () => null,
    });
    const behind = classifyMountRows({
      group,
      statusOf: () => BEHIND,
      commitsAfterMergeOf: () => null,
    });
    const landed = classifyMountRows({
      group,
      statusOf: () => AT_BASE,
      commitsAfterMergeOf: () => null,
    });

    expect(idsOf(loading.open)).toEqual([FIRST, SECOND, THIRD]);
    expect(idsOf(behind.open)).toEqual([FIRST, SECOND, THIRD]);
    expect(idsOf(landed.finished)).toEqual([FIRST, SECOND, THIRD]);
    expect(landed.finished.every((row) => row.isFinished)).toBe(true);
  });

  it('brings a merged row back to open only when new commits followed the merge', () => {
    const group = groupOf({ [FIRST]: 'merged', [SECOND]: 'merged', [THIRD]: 'open' });

    const result = classifyMountRows({
      group,
      statusOf: () => BEHIND,
      commitsAfterMergeOf: (row) => (row.mountId === SECOND ? 2 : null),
    });

    expect(idsOf(result.finished)).toEqual([FIRST]);
    expect(idsOf(result.open)).toEqual([THIRD, SECOND]);
    expect(result.open.find((row) => row.mountId === SECOND)?.isFinished).toBe(false);
  });

  it('classifies a folder project by its request alone', () => {
    const group = groupOf({ [FIRST]: 'merged' });
    const folder = {
      ...group,
      projectKind: 'folder' as const,
      rows: group.rows.map((row) => ({ ...row, projectKind: 'folder' as const })),
    };

    const result = classifyMountRows({
      group: folder,
      statusOf: () => AT_BASE,
      commitsAfterMergeOf: () => null,
    });

    expect(idsOf(result.finished)).toEqual([FIRST]);
    expect(idsOf(result.open)).toEqual([SECOND, THIRD]);
  });
});
