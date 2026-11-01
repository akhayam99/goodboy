import { describe, expect, it } from 'vitest';
import {
  brandId,
  type BitbucketIntegrationConfig,
  type GitlabIntegrationConfig,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type IsoDateTime,
  type WorkspaceId,
} from '@goodboy/types';
import { viewerIdentityOf } from './viewerIdentityOf';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const STAMP = brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' });

const baseOf = () => ({
  id: brandId<IntegrationBindingId>({ value: 'binding-1' }),
  workspaceId: WORKSPACE,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-1' }),
  createdAt: STAMP,
  updatedAt: STAMP,
});

const gitlabOf = ({
  config,
}: {
  readonly config: GitlabIntegrationConfig;
}): IntegrationBinding => ({
  ...baseOf(),
  provider: 'gitlab',
  config,
});

const bitbucketOf = ({
  config,
}: {
  readonly config: BitbucketIntegrationConfig;
}): IntegrationBinding => ({ ...baseOf(), provider: 'bitbucket', config });

const stateOf = ({ bindings = [] }: { readonly bindings?: ReadonlyArray<IntegrationBinding> }) => ({
  githubStatus: null,
  githubWorkspaceStatus: {},
  workspaceIntegrations: { [WORKSPACE]: bindings },
});

describe('viewerIdentityOf', () => {
  it('is unknown for GitHub until a status with a user has loaded', () => {
    expect(viewerIdentityOf({ state: stateOf({}), kind: 'github' })).toBeNull();
    expect(
      viewerIdentityOf({
        state: {
          ...stateOf({}),
          githubStatus: { mode: 'gh-cli', available: true, user: 'Harborline-Dev' },
        },
        kind: 'github',
      }),
    ).toEqual(new Set(['harborline-dev']));
  });

  it('reads the GitLab username and the display name from the connection', () => {
    const state = stateOf({
      bindings: [
        gitlabOf({
          config: { userName: 'Kenji W', userId: '7', username: 'kenji-w', host: 'gitlab.com' },
        }),
      ],
    });

    expect(viewerIdentityOf({ state, kind: 'gitlab' })).toEqual(new Set(['kenji-w', 'kenji w']));
    expect(viewerIdentityOf({ state, kind: 'bitbucket' })).toBeNull();
  });

  it('is unknown for a GitLab connection made before the username was kept', () => {
    const state = stateOf({
      bindings: [gitlabOf({ config: { userName: 'Kenji W', userId: '7', host: 'gitlab.com' } })],
    });

    expect(viewerIdentityOf({ state, kind: 'gitlab' })).toBeNull();
  });

  it('reads the Bitbucket nickname and the display name from the connection', () => {
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
      ],
    });

    expect(viewerIdentityOf({ state, kind: 'bitbucket' })).toEqual(new Set(['omar-t', 'omar t']));
  });
});
