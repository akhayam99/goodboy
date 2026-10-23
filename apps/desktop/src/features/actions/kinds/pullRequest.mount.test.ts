// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestState,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { MountGithubState, SessionGithubState } from '../../../store/types';
import { aRebaseRun } from '../../history/testing/aRebaseRun';
import { brandedId } from '../../history/testing/brandedId';
import { evaluatePrMergeReadiness } from '../../review/prMergeReadiness';
import { PULL_REQUEST_KIND } from './pullRequest';

const SESSION_ID = brandedId<SessionId>({ value: 'session-ledger' });
const PROJECT_ID = brandedId<ProjectId>({ value: 'project-ledger-core' });
const WRITE_MOUNT_ID = brandedId<MountId>({ value: 'mount-ledger-rates' });
const SHOWN_MOUNT_ID = brandedId<MountId>({ value: 'mount-ledger-fees' });
const STAMP = brandedId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' });

type MountParams = {
  readonly mountId: MountId;
  readonly branch: string;
  readonly parallelIndex: number;
};

const mountOf = ({ mountId, branch, parallelIndex }: MountParams): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'ledger-core',
  worktreePath: `/worktrees/${branch}`,
  lastWorktreePath: `/worktrees/${branch}`,
  repoRoot: '/repos/ledger-core',
  branch,
  baseBranch: null,
  parallelIndex,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const WRITE_MOUNT = mountOf({ mountId: WRITE_MOUNT_ID, branch: 'hl/feat-rates', parallelIndex: 0 });
const SHOWN_MOUNT = mountOf({ mountId: SHOWN_MOUNT_ID, branch: 'hl/feat-fees', parallelIndex: 1 });

type PrParams = {
  readonly number: number;
  readonly branch: string;
};

const prOf = ({ number, branch }: PrParams): PullRequestState => ({
  number,
  title: `Ledger change ${number}`,
  url: `https://github.com/northwind/ledger-core/pull/${number}`,
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: branch,
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: STAMP,
});

type GithubParams = {
  readonly pr: PullRequestState;
};

const githubOf = ({ pr }: GithubParams): SessionGithubState => ({
  pr,
  linkedIssues: [],
  fetchedAt: STAMP,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

type MountGithubParams = {
  readonly mount: SessionProjectMount;
  readonly pr: PullRequestState;
};

const mountGithubOf = ({ mount, pr }: MountGithubParams): MountGithubState => ({
  ...githubOf({ pr }),
  mountId: mount.mountId,
  projectId: PROJECT_ID,
  revision: 1,
  repository: 'northwind/ledger-core',
  host: 'github.com',
  branch: mount.branch,
  prs: [pr],
  links: [],
});

const WRITE_PR = prOf({ number: 318, branch: WRITE_MOUNT.branch });
const SHOWN_PR = prOf({ number: 412, branch: SHOWN_MOUNT.branch });
const WRITE_GITHUB = mountGithubOf({ mount: WRITE_MOUNT, pr: WRITE_PR });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [
      aSession({
        id: SESSION_ID,
        workspaceId: brandedId<WorkspaceId>({ value: 'workspace-northwind' }),
      }),
    ],
    projects: [aProject({ id: PROJECT_ID, name: 'ledger-core' })],
    sessionActiveMount: { [SESSION_ID]: WRITE_MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionProjectMounts: { [SESSION_ID]: [WRITE_MOUNT, SHOWN_MOUNT] },
    sessionGithub: { [SESSION_ID]: githubOf({ pr: WRITE_PR }) },
    mountGithub: {
      [WRITE_MOUNT_ID]: WRITE_GITHUB,
      [SHOWN_MOUNT_ID]: mountGithubOf({ mount: SHOWN_MOUNT, pr: SHOWN_PR }),
    },
  });
});

type FactsParams = {
  readonly mountId?: MountId | null;
};

const factsOf = ({ mountId }: FactsParams) =>
  PULL_REQUEST_KIND.facts({
    state: useAppStore.getState(),
    target: {
      kind: 'pullRequest',
      sessionId: SESSION_ID,
      prNumber: null,
      ...(mountId === undefined ? {} : { mountId }),
    },
  });

describe('the pull request action target', () => {
  it('reads the pull request of the shown branch, not the write destination', () => {
    const facts = factsOf({ mountId: SHOWN_MOUNT_ID });
    expect(facts?.number).toBe(412);
    expect(facts?.mountId).toBe(SHOWN_MOUNT_ID);
  });

  it('says there is none when the shown branch has no pull request', () => {
    useAppStore.setState({ mountGithub: { [WRITE_MOUNT_ID]: WRITE_GITHUB } });
    expect(factsOf({ mountId: SHOWN_MOUNT_ID })?.pr).toBeNull();
  });

  it('sends a conflict to the rebase panel whenever a stop is open on the shown branch', () => {
    const conflicting = { ...SHOWN_PR, mergeable: false };
    useAppStore.setState((state) => ({
      mountGithub: {
        ...state.mountGithub,
        [SHOWN_MOUNT_ID]: mountGithubOf({ mount: SHOWN_MOUNT, pr: conflicting }),
      },
    }));
    const blockerOf = (): string | undefined => {
      const facts = factsOf({ mountId: SHOWN_MOUNT_ID });
      return facts === null ? undefined : evaluatePrMergeReadiness({ facts }).blockers[0];
    };
    expect(blockerOf()).toBe('Conflicts with main. Rebase on main from the Branch header.');

    useAppStore.setState({
      historyRuns: {
        [WRITE_MOUNT_ID]: aRebaseRun({
          sessionId: SESSION_ID,
          mountId: WRITE_MOUNT_ID,
          phase: 'stopped',
        }),
      },
    });
    expect(blockerOf()).toBe('Conflicts with main. Rebase on main from the Branch header.');

    useAppStore.setState({
      historyRuns: {
        [SHOWN_MOUNT_ID]: aRebaseRun({
          sessionId: SESSION_ID,
          mountId: SHOWN_MOUNT_ID,
          phase: 'stopped',
          stop: { reason: 'dirty', message: 'Uncommitted files', files: [], sha: null },
        }),
      },
    });
    expect(factsOf({ mountId: SHOWN_MOUNT_ID })?.isRebaseStopOpen).toBe(true);
    expect(blockerOf()).toBe('Conflicts with main. Resolve them in the banner.');
  });

  it('keeps the write destination when no branch is named', () => {
    const facts = factsOf({});
    expect(facts?.number).toBe(318);
    expect(facts?.mountId).toBeNull();
  });
});
