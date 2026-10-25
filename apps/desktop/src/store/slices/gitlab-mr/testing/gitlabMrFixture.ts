import type {
  GitlabIntegrationBinding,
  MountId,
  ProjectId,
  SessionMountView,
} from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { aProject, aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import type { GitlabMergeRequest } from '../../../../features/integrations/gitlab/client';
import { storySpies } from '../../../storyHarness';
import type { MountGitlabMrState } from '../state';

type MountParams = {
  readonly id: MountId;
  readonly projectId: ProjectId;
  readonly name: string;
};

type MrParams = {
  readonly iid: number;
  readonly name: string;
};

type MountStateParams = {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly mr: GitlabMergeRequest;
};

type SeedParams = {
  readonly hasGitlab?: boolean;
};

const REVIEWED_HEAD = 'a41c9e2b7d3f';

const WORKSPACE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const LEDGER = aProject({ workspaceId: WORKSPACE.id, name: 'ledger-core' });
const RELAY = aProject({ workspaceId: WORKSPACE.id, name: 'notify-relay' });
const SESSION = aSession({ workspaceId: WORKSPACE.id });

const isMountId = (value: string): value is MountId => value.startsWith('mount-');

const mountIdOf = ({ value }: { readonly value: string }): MountId => {
  if (!isMountId(value)) {
    throw new Error(`not a mount id: ${value}`);
  }
  return value;
};

const recordOf = ({ value }: { readonly value: unknown }): Readonly<Record<string, unknown>> =>
  isRecord(value) ? value : {};

const isGitlabBinding = (value: unknown): value is GitlabIntegrationBinding =>
  isRecord(value) && value.provider === 'gitlab' && isRecord(value.config);

const gitlabBinding = (): GitlabIntegrationBinding => {
  const binding: unknown = {
    id: 'binding-gitlab',
    workspaceId: WORKSPACE.id,
    projectId: null,
    credentialId: 'credential-gitlab',
    provider: 'gitlab',
    config: { host: 'gitlab.com', userName: 'kenji-w', userId: '7' },
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
  };
  if (!isGitlabBinding(binding)) {
    throw new Error('gitlab binding fixture is malformed');
  }
  return binding;
};

const LEDGER_MOUNT = mountIdOf({ value: 'mount-ledger' });
const RELAY_MOUNT = mountIdOf({ value: 'mount-relay' });

type InvokeCall = { readonly command: string; readonly args: Readonly<Record<string, unknown>> };

const invokeCalls = ({ command }: { readonly command: string }): ReadonlyArray<InvokeCall> =>
  storySpies.tauriInvoke.mock.calls
    .map(([name, args]) => ({ command: String(name), args: recordOf({ value: args }) }))
    .filter((call) => call.command === command);

const mountView = ({ id, projectId, name }: MountParams): SessionMountView => ({
  id,
  sessionId: SESSION.id,
  projectId,
  mountName: name,
  worktreePath: `/worktrees/${name}`,
  lastWorktreePath: null,
  repoRoot: `/repos/${name}`,
  branch: `ak/${name}`,
  baseBranch: null,
  parallelIndex: 0,
  repoSlug: null,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
});

const makeMr = ({ iid, name }: MrParams): GitlabMergeRequest => ({
  id: iid * 100,
  iid,
  projectId: 1,
  title: `Harborline change ${iid}`,
  description: null,
  state: 'opened',
  webUrl: `https://gitlab.com/acme/${name}/-/merge_requests/${iid}`,
  sourceBranch: `ak/${name}`,
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: TEST_NOW,
  sha: REVIEWED_HEAD,
});

const mountState = ({ mountId, projectId, name, mr }: MountStateParams): MountGitlabMrState => ({
  mountId,
  projectId,
  revision: 1,
  host: 'gitlab.com',
  projectPath: `acme/${name}`,
  branch: `ak/${name}`,
  mr,
  mrs: [mr],
  links: [],
  approvals: null,
  fetchedAt: TEST_NOW,
  loading: false,
  error: null,
});

const seedState = ({ hasGitlab = true }: SeedParams = {}) => ({
  workspaces: [WORKSPACE],
  currentWorkspaceId: WORKSPACE.id,
  projects: [LEDGER, RELAY],
  sessions: [SESSION],
  sessionMounts: {
    [SESSION.id]: [
      mountView({ id: LEDGER_MOUNT, projectId: LEDGER.id, name: 'ledger-core' }),
      mountView({ id: RELAY_MOUNT, projectId: RELAY.id, name: 'notify-relay' }),
    ],
  },
  sessionActiveMount: { [SESSION.id]: LEDGER_MOUNT },
  sessionActiveProject: { [SESSION.id]: LEDGER.id },
  workspaceIntegrations: { [WORKSPACE.id]: hasGitlab ? [gitlabBinding()] : [] },
});

const remoteUrlOf = ({ repoPath }: { readonly repoPath: string }): string =>
  `git@gitlab.com:acme${repoPath.replace('/repos', '')}.git`;

export const gitlabMrFixture = {
  workspace: WORKSPACE,
  session: SESSION,
  ledger: LEDGER,
  relay: RELAY,
  ledgerMount: LEDGER_MOUNT,
  relayMount: RELAY_MOUNT,
  reviewedHead: REVIEWED_HEAD,
  makeMr,
  invokeCalls,
  recordOf,
  mountState,
  seedState,
  remoteUrlOf,
};
