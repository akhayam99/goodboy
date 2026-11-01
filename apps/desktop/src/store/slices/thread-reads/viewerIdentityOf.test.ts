import { describe, expect, it } from 'vitest';
import {
  brandId,
  type BitbucketIntegrationConfig,
  type GitlabIntegrationConfig,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type IsoDateTime,
  type ProjectId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { viewerIdentityOf } from './viewerIdentityOf';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const OTHER_WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const PROJECT_LEDGER = brandId<ProjectId>({ value: 'project-ledger-core' });
const PROJECT_PAYMENTS = brandId<ProjectId>({ value: 'project-payments-api' });
const STAMP = brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' });

const baseOf = ({
  workspaceId = WORKSPACE,
  projectId = null,
}: {
  readonly workspaceId?: WorkspaceId;
  readonly projectId?: ProjectId | null;
}) => ({
  id: brandId<IntegrationBindingId>({ value: `binding-${workspaceId}-${projectId ?? 'all'}` }),
  workspaceId,
  projectId,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-1' }),
  createdAt: STAMP,
  updatedAt: STAMP,
});

type ScopeParams = {
  readonly workspaceId?: WorkspaceId;
  readonly projectId?: ProjectId | null;
};

const gitlabOf = ({
  config,
  ...scope
}: ScopeParams & { readonly config: GitlabIntegrationConfig }): IntegrationBinding => ({
  ...baseOf(scope),
  provider: 'gitlab',
  config,
});

const bitbucketOf = ({
  config,
  ...scope
}: ScopeParams & { readonly config: BitbucketIntegrationConfig }): IntegrationBinding => ({
  ...baseOf(scope),
  provider: 'bitbucket',
  config,
});

const stateOf = ({ bindings = [] }: { readonly bindings?: ReadonlyArray<IntegrationBinding> }) => ({
  sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE })],
  githubStatus: null,
  githubWorkspaceStatus: {},
  workspaceIntegrations: {
    [WORKSPACE]: bindings.filter((binding) => binding.workspaceId === WORKSPACE),
    [OTHER_WORKSPACE]: bindings.filter((binding) => binding.workspaceId === OTHER_WORKSPACE),
  },
});

const gitlabEntry = {
  kind: 'gitlab',
  projectId: PROJECT_LEDGER,
  url: 'https://gitlab.com/harborline/ledger-core/-/merge_requests/4',
} as const;

const bitbucketEntry = {
  kind: 'bitbucket',
  projectId: PROJECT_LEDGER,
  url: 'https://bitbucket.org/northwind/ledger-core/pull-requests/4',
} as const;

const githubEntry = { kind: 'github', projectId: PROJECT_LEDGER, url: null } as const;

describe('viewerIdentityOf', () => {
  it('is unknown for GitHub until a status with a user has loaded', () => {
    expect(
      viewerIdentityOf({ state: stateOf({}), sessionId: SESSION_ID, entry: githubEntry }),
    ).toBeNull();
    expect(
      viewerIdentityOf({
        state: {
          ...stateOf({}),
          githubStatus: { mode: 'gh-cli', available: true, user: 'Harborline-Dev' },
        },
        sessionId: SESSION_ID,
        entry: githubEntry,
      }),
    ).toEqual(new Set(['harborline-dev']));
  });

  it('takes the account of the workspace of the session and ignores another workspace', () => {
    const state = {
      ...stateOf({}),
      githubWorkspaceStatus: {
        [OTHER_WORKSPACE]: { mode: 'pat', available: true, user: 'northwind-rev' },
      },
    } as const;

    expect(viewerIdentityOf({ state, sessionId: SESSION_ID, entry: githubEntry })).toBeNull();
    expect(
      viewerIdentityOf({
        state: {
          ...state,
          githubWorkspaceStatus: {
            ...state.githubWorkspaceStatus,
            [WORKSPACE]: { mode: 'pat', available: true, user: 'harborline-dev' },
          },
        },
        sessionId: SESSION_ID,
        entry: githubEntry,
      }),
    ).toEqual(new Set(['harborline-dev']));
  });

  it('does not fall back to the default account when the workspace has its own scoped token', () => {
    const state = {
      ...stateOf({}),
      githubStatus: { mode: 'gh-cli', available: true, user: 'northwind-rev' },
      githubWorkspaceStatus: {
        [WORKSPACE]: { mode: 'pat', available: true, scoped: true, user: undefined },
      },
    } as const;

    expect(viewerIdentityOf({ state, sessionId: SESSION_ID, entry: githubEntry })).toBeNull();
  });

  it('reads only the GitLab username, never the display name', () => {
    const state = stateOf({
      bindings: [
        gitlabOf({
          config: { userName: 'Kenji W', userId: '7', username: 'kenji-w', host: 'gitlab.com' },
        }),
      ],
    });

    expect(viewerIdentityOf({ state, sessionId: SESSION_ID, entry: gitlabEntry })).toEqual(
      new Set(['kenji-w']),
    );
    expect(viewerIdentityOf({ state, sessionId: SESSION_ID, entry: bitbucketEntry })).toBeNull();
  });

  it('is unknown for a GitLab connection made before the username was kept', () => {
    const state = stateOf({
      bindings: [gitlabOf({ config: { userName: 'Kenji W', userId: '7', host: 'gitlab.com' } })],
    });

    expect(viewerIdentityOf({ state, sessionId: SESSION_ID, entry: gitlabEntry })).toBeNull();
  });

  it('keeps the GitLab state unknown when only another host or another workspace has an identity', () => {
    const state = stateOf({
      bindings: [
        gitlabOf({
          config: { userName: 'Kenji W', userId: '7', username: 'kenji-w', host: 'git.acme.test' },
        }),
        gitlabOf({
          workspaceId: OTHER_WORKSPACE,
          config: { userName: 'Dana R', userId: '8', username: 'dana-r', host: 'gitlab.com' },
        }),
      ],
    });

    expect(viewerIdentityOf({ state, sessionId: SESSION_ID, entry: gitlabEntry })).toBeNull();
  });

  it('prefers the connection of the project over the one of the workspace', () => {
    const state = stateOf({
      bindings: [
        gitlabOf({
          config: { userName: 'Kenji W', userId: '7', username: 'kenji-w', host: 'gitlab.com' },
        }),
        gitlabOf({
          projectId: PROJECT_LEDGER,
          config: {
            userName: 'Kenji W',
            userId: '7',
            username: 'kenji-ledger',
            host: 'gitlab.com',
          },
        }),
      ],
    });

    expect(viewerIdentityOf({ state, sessionId: SESSION_ID, entry: gitlabEntry })).toEqual(
      new Set(['kenji-ledger']),
    );
    expect(
      viewerIdentityOf({
        state,
        sessionId: SESSION_ID,
        entry: { ...gitlabEntry, projectId: PROJECT_PAYMENTS },
      }),
    ).toEqual(new Set(['kenji-w']));
  });

  it('reads only the Bitbucket nickname, never the display name', () => {
    const state = stateOf({
      bindings: [
        bitbucketOf({
          config: {
            workspaceSlug: 'northwind',
            email: 'dev@northwind.test',
            nickname: 'omar-t',
            displayName: 'Omar T',
          },
        }),
        bitbucketOf({
          workspaceId: OTHER_WORKSPACE,
          config: { workspaceSlug: 'acme', email: 'dev@acme.test', nickname: 'dana-r' },
        }),
      ],
    });

    expect(viewerIdentityOf({ state, sessionId: SESSION_ID, entry: bitbucketEntry })).toEqual(
      new Set(['omar-t']),
    );
  });

  it('is unknown when the session is not loaded', () => {
    expect(
      viewerIdentityOf({
        state: { ...stateOf({}), sessions: [] },
        sessionId: SESSION_ID,
        entry: githubEntry,
      }),
    ).toBeNull();
  });
});
