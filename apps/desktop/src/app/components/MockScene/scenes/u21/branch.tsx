import { useEffect, useState } from 'react';
import type {
  MountId,
  Project,
  ProjectId,
  PullRequestState,
  SessionProjectMount,
} from '@goodboy/types';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../../store';
import type { MountGithubState } from '../../../../../store/types';
import { handlersFor } from '../brand/DiffStage';
import { BRANCH_FILES_PATCH } from '../brand/contextDiffPatch';
import { mockSceneIpc } from '../mockSceneIpc';
import { NOW_ISO, SESSION, SESSION_ID, WORKSPACE_ID, seedResolveScene } from '../resolveSeed';

type Variant = 'switcher' | 'description-open';

type Props = {
  readonly variant: Variant;
};

const PAYMENTS_ID = 'mock-u21-project-payments-api' as ProjectId;
const LEDGER_ID = 'mock-u21-project-ledger-core' as ProjectId;
const FIX_MOUNT_ID = 'mock-u21-mount-fix-duplicate-credit' as MountId;
const NOTES_MOUNT_ID = 'mock-u21-mount-retry-credit-notes' as MountId;
const LEDGER_MOUNT_ID = 'mock-u21-mount-ledger-posting-dedupe' as MountId;

const FIX_PATH = '~/code/harborline/payments-api-fix-duplicate-credit';
const NOTES_PATH = '~/code/harborline/payments-api-retry-credit-notes';
const LEDGER_PATH = '~/code/harborline/ledger-core-posting-dedupe';

const PR_BODY =
  'Retried webhook deliveries no longer post a second credit. The credit row now carries the processor event id, and the insert is guarded by a unique constraint on it.';

const mountOf = ({
  mountId,
  projectId,
  name,
  worktreePath,
  branch,
  index,
}: {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly index: number;
}): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId,
  mountName: name,
  worktreePath,
  lastWorktreePath: null,
  repoRoot: `~/code/harborline/${name}`,
  branch,
  baseBranch: 'main',
  parallelIndex: index,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const FIX_MOUNT = mountOf({
  mountId: FIX_MOUNT_ID,
  projectId: PAYMENTS_ID,
  name: 'payments-api',
  worktreePath: FIX_PATH,
  branch: 'hl/fix-duplicate-credit',
  index: 0,
});

const NOTES_MOUNT = mountOf({
  mountId: NOTES_MOUNT_ID,
  projectId: PAYMENTS_ID,
  name: 'payments-api',
  worktreePath: NOTES_PATH,
  branch: 'hl/retry-credit-notes',
  index: 1,
});

const LEDGER_MOUNT = mountOf({
  mountId: LEDGER_MOUNT_ID,
  projectId: LEDGER_ID,
  name: 'ledger-core',
  worktreePath: LEDGER_PATH,
  branch: 'hl/ledger-posting-dedupe',
  index: 0,
});

const projectOf = ({ id, name }: { readonly id: ProjectId; readonly name: string }): Project => {
  const workspace = useAppStore.getState().workspaces[0];
  if (workspace === undefined) {
    throw new Error('the resolve seed has no workspace');
  }
  return {
    id,
    workspaceId: WORKSPACE_ID,
    name,
    rootPath: `~/code/harborline/${name}`,
    kind: 'repo',
    baseBranch: 'main',
    overrides: workspace.overrides,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
};

const githubOf = ({
  mount,
  pr,
}: {
  readonly mount: SessionProjectMount;
  readonly pr: PullRequestState | null;
}): MountGithubState => ({
  linkedIssues: [],
  fetchedAt: NOW_ISO,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
  pr,
  mountId: mount.mountId,
  projectId: mount.projectId,
  revision: mount.revision,
  repository: `harborline/${mount.mountName}`,
  host: 'github.com',
  branch: mount.branch,
  prs: pr === null ? [] : [pr],
  links: [],
});

const seed = ({ variant }: Props): void => {
  seedResolveScene({ expandedThreadId: null });
  const state = useAppStore.getState();
  const github = state.sessionGithub[SESSION_ID];
  if (github === undefined || github.pr === null) {
    throw new Error('the resolve seed has no pull request');
  }
  const current = github.pr;
  const mounts = variant === 'switcher' ? [FIX_MOUNT, NOTES_MOUNT, LEDGER_MOUNT] : [FIX_MOUNT];
  const drafted: PullRequestState = {
    ...current,
    number: 331,
    title: 'Retry credit notes through the same guard',
    isDraft: true,
    headBranch: 'hl/retry-credit-notes',
    body: '',
  };
  const withBody: PullRequestState =
    variant === 'description-open' ? { ...current, body: PR_BODY } : current;
  useAppStore.setState({
    projects: [
      projectOf({ id: PAYMENTS_ID, name: 'payments-api' }),
      projectOf({ id: LEDGER_ID, name: 'ledger-core' }),
    ],
    sessionProjectMounts: { [SESSION_ID]: mounts },
    sessionActiveMount: { [SESSION_ID]: FIX_MOUNT_ID },
    diffMountPath: { [SESSION_ID]: FIX_PATH },
    sessionGithub: {
      [SESSION_ID]: { ...github, pr: withBody },
    },
    mountGithub: {
      [FIX_MOUNT_ID]: githubOf({ mount: FIX_MOUNT, pr: withBody }),
      [NOTES_MOUNT_ID]: githubOf({ mount: NOTES_MOUNT, pr: drafted }),
      [LEDGER_MOUNT_ID]: githubOf({ mount: LEDGER_MOUNT, pr: null }),
    },
  });
};

const HANDLERS = handlersFor(BRANCH_FILES_PATCH);
const OPEN_DELAY_MS = 400;

const EMPTY_THREADS = JSON.stringify({
  data: {
    repository: {
      pullRequest: {
        reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
      },
    },
  },
});

const isGraphqlCall = ({ payload }: { readonly payload: unknown }): boolean =>
  typeof payload === 'object' &&
  payload !== null &&
  'args' in payload &&
  Array.isArray(payload.args) &&
  payload.args.includes('graphql');

const installWorktreeIpc = (): void => {
  mockSceneIpc((command, payload) => {
    if (command === 'gh_run') {
      return {
        stdout: isGraphqlCall({ payload }) ? EMPTY_THREADS : '[]',
        stderr: '',
        exitCode: 0,
      };
    }
    return HANDLERS[command]?.(undefined) ?? null;
  });
};

const BranchU21Scene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seed({ variant });
    installWorktreeIpc();
    setIsReady(true);
  }, [variant]);

  useEffect(() => {
    if (!isReady || variant !== 'switcher') {
      return;
    }
    const timer = window.setTimeout(
      () => document.querySelector<HTMLElement>('[data-testid="branch-switcher"]')?.click(),
      OPEN_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isReady, variant]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <BranchPage session={SESSION} workingDir={FIX_PATH} />
    </main>
  );
};

export const U21_BRANCH_SCENES = {
  'branch-switcher': () => <BranchU21Scene variant="switcher" />,
  'branch-description-open': () => <BranchU21Scene variant="description-open" />,
};
