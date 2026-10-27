// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type GitlabIntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type IsoDateTime,
  type MountId,
  type Project,
  type SessionMountView,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import type { MountGitlabMrState } from '../gitlab-mr/state';
import { aMountGithub } from '../github/testing/aMountGithub';
import type { HostReachability } from '../host-reachability/types';
import { sessionRequestFetchOf } from './sessionRequestFetchOf';

const WORKSPACE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const LEDGER = aProject({
  workspaceId: WORKSPACE.id,
  name: 'ledger-core',
  remoteUrl: 'git@github.com:harborline/ledger-core.git',
});
const RELAY = aProject({
  workspaceId: WORKSPACE.id,
  name: 'notify-relay',
  remoteUrl: 'https://gitlab.com/harborline/notify-relay.git',
});
const SESSION = aSession({ workspaceId: WORKSPACE.id });
const LEDGER_MOUNT = brandId<MountId>({ value: 'mount-ledger' });
const RELAY_MOUNT = brandId<MountId>({ value: 'mount-relay' });
const EARLIER = brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' });
const LATER = brandId<IsoDateTime>({ value: '2026-10-07T08:05:00.000Z' });

const UNREACHABLE: HostReachability = {
  status: 'unreachable',
  since: 1,
  failures: 1,
  lastFailureAt: 1,
  reason: 'network',
};

const GITLAB: GitlabIntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-gitlab' }),
  workspaceId: WORKSPACE.id,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-gitlab' }),
  provider: 'gitlab',
  config: { host: 'gitlab.com', userName: 'kenji-w', userId: '7' },
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

type ViewParams = {
  readonly id: MountId;
  readonly project: Project;
};

const viewOf = ({ id, project }: ViewParams): SessionMountView => ({
  id,
  sessionId: SESSION.id,
  projectId: project.id,
  mountName: project.name,
  worktreePath: `/worktrees/${project.name}`,
  lastWorktreePath: null,
  repoRoot: `/repos/${project.name}`,
  branch: `ak/${project.name}`,
  baseBranch: 'main',
  parallelIndex: 0,
  repoSlug: null,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
});

type EntryParams = {
  readonly fetchedAt: IsoDateTime | null;
  readonly failedAt: IsoDateTime | null;
};

const gitlabEntry = ({ fetchedAt, failedAt }: EntryParams): MountGitlabMrState => ({
  mountId: RELAY_MOUNT,
  projectId: RELAY.id,
  revision: 1,
  host: 'gitlab.com',
  projectPath: 'harborline/notify-relay',
  branch: 'ak/notify-relay',
  mr: null,
  mrs: [],
  links: [],
  approvals: null,
  fetchedAt,
  failedAt,
  loading: false,
  error: null,
});

type SessionRequestFetchState = Parameters<typeof sessionRequestFetchOf>[0]['state'];

const stateOf = (overrides: Partial<SessionRequestFetchState> = {}): SessionRequestFetchState => ({
  sessions: [SESSION],
  projects: [LEDGER, RELAY],
  sessionProjectMounts: {},
  sessionMounts: { [SESSION.id]: [viewOf({ id: RELAY_MOUNT, project: RELAY })] },
  sessionActiveMount: { [SESSION.id]: RELAY_MOUNT },
  sessionActiveProject: { [SESSION.id]: RELAY.id },
  githubStatus: { mode: 'gh-cli', available: true },
  workspaceIntegrations: { [WORKSPACE.id]: [GITLAB] },
  mountGithub: {},
  mountGitlabMr: {},
  mountBitbucketPr: {},
  hostReachability: {},
  ...overrides,
});

const fetchOf = (state: SessionRequestFetchState) =>
  sessionRequestFetchOf({ state, sessionId: SESSION.id });

describe('sessionRequestFetchOf', () => {
  it('waits on GitLab, not GitHub, for a GitLab mount that was never read', () => {
    expect(fetchOf(stateOf())).toEqual({ state: 'unknown', host: 'gitlab' });
  });

  it('is known once GitLab answered with no merge request', () => {
    const state = stateOf({
      mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ fetchedAt: EARLIER, failedAt: null }) },
    });

    expect(fetchOf(state)).toEqual({ state: 'known', host: 'gitlab' });
  });

  it('is unreachable when the host reachability says GitLab did not answer', () => {
    const state = stateOf({
      mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ fetchedAt: EARLIER, failedAt: LATER }) },
      hostReachability: { gitlab: UNREACHABLE },
    });

    expect(fetchOf(state)).toEqual({ state: 'unreachable', host: 'gitlab' });
  });

  it('is unreachable for a GitLab mount never read while the host is down', () => {
    const state = stateOf({ hostReachability: { gitlab: UNREACHABLE } });

    expect(fetchOf(state)).toEqual({ state: 'unreachable', host: 'gitlab' });
  });

  it('does not call GitLab unreachable when it answered with a refusal', () => {
    const state = stateOf({
      mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ fetchedAt: EARLIER, failedAt: LATER }) },
    });

    expect(fetchOf(state)).toEqual({ state: 'known', host: 'gitlab' });
  });

  it('is known again once GitLab recovered', () => {
    const state = stateOf({
      mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ fetchedAt: LATER, failedAt: null }) },
      hostReachability: { gitlab: { status: 'recovered', at: 2 } },
    });

    expect(fetchOf(state)).toEqual({ state: 'known', host: 'gitlab' });
  });

  it('keeps a GitHub mount unreachable on its own failed fetch', () => {
    const state = stateOf({
      sessionMounts: { [SESSION.id]: [viewOf({ id: LEDGER_MOUNT, project: LEDGER })] },
      sessionActiveMount: { [SESSION.id]: LEDGER_MOUNT },
      sessionActiveProject: { [SESSION.id]: LEDGER.id },
      mountGithub: {
        [LEDGER_MOUNT]: {
          ...aMountGithub({ mountId: LEDGER_MOUNT, projectId: LEDGER.id }),
          fetchedAt: EARLIER,
          failedAt: LATER,
        },
      },
      hostReachability: { gitlab: UNREACHABLE },
    });

    expect(fetchOf(state)).toEqual({ state: 'unreachable', host: 'github' });
  });

  it('does not wait for a GitLab that is not connected', () => {
    const state = stateOf({ workspaceIntegrations: { [WORKSPACE.id]: [] } });

    expect(fetchOf(state)).toEqual({ state: 'known', host: 'gitlab' });
  });

  it('does not read the GitHub fetch for a GitLab mount', () => {
    const state = stateOf({
      mountGithub: {
        [RELAY_MOUNT]: {
          ...aMountGithub({ mountId: RELAY_MOUNT, projectId: RELAY.id }),
          failedAt: LATER,
          fetchedAt: null,
        },
      },
    });

    expect(fetchOf(state)).toEqual({ state: 'unknown', host: 'gitlab' });
  });

  it('shows the worst mount of a session with one GitHub and one GitLab mount', () => {
    const state = stateOf({
      sessionMounts: {
        [SESSION.id]: [
          viewOf({ id: LEDGER_MOUNT, project: LEDGER }),
          viewOf({ id: RELAY_MOUNT, project: RELAY }),
        ],
      },
      mountGithub: {
        [LEDGER_MOUNT]: aMountGithub({ mountId: LEDGER_MOUNT, projectId: LEDGER.id }),
      },
      mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ fetchedAt: null, failedAt: LATER }) },
      hostReachability: { gitlab: UNREACHABLE },
    });

    expect(fetchOf(state)).toEqual({ state: 'unreachable', host: 'gitlab' });
  });

  it('is known for a session with nothing to fetch', () => {
    expect(fetchOf(stateOf({ sessionMounts: { [SESSION.id]: [] } }))).toEqual({
      state: 'known',
      host: 'github',
    });
  });
});
