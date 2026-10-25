// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type GitlabIntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type MountId,
  type Project,
} from '@goodboy/types';
import { aProject, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import { mountRequestHostOf, type MountHostState } from './mountRequestHostOf';

const WORKSPACE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const MOUNT = brandId<MountId>({ value: 'mount-relay' });

const NORTHWIND: GitlabIntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-northwind' }),
  workspaceId: WORKSPACE.id,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-northwind' }),
  provider: 'gitlab',
  config: { host: 'code.northwind.test', userName: 'kenji-w', userId: '7' },
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

type StateParams = {
  readonly project: Project;
  readonly bindings?: ReadonlyArray<GitlabIntegrationBinding>;
};

const stateOf = ({ project, bindings = [] }: StateParams): MountHostState => ({
  projects: [project],
  workspaceIntegrations: { [WORKSPACE.id]: bindings },
  mountGitlabMr: {},
  mountBitbucketPr: {},
});

const hostOf = ({
  state,
  project,
}: {
  readonly state: MountHostState;
  readonly project: Project;
}) =>
  mountRequestHostOf({
    state,
    workspaceId: WORKSPACE.id,
    mount: { id: MOUNT, projectId: project.id },
  });

describe('mountRequestHostOf', () => {
  it('reads the host from the project remote', () => {
    const project = aProject({
      workspaceId: WORKSPACE.id,
      remoteUrl: 'https://gitlab.com/harborline/notify-relay.git',
    });

    expect(hostOf({ state: stateOf({ project }), project })).toBe('gitlab');
  });

  it('reads a self-hosted GitLab from the host the workspace connected', () => {
    const project = aProject({
      workspaceId: WORKSPACE.id,
      remoteUrl: 'git@code.northwind.test:harborline/notify-relay.git',
    });

    expect(hostOf({ state: stateOf({ project, bindings: [NORTHWIND] }), project })).toBe('gitlab');
    expect(hostOf({ state: stateOf({ project }), project })).toBe('github');
  });

  it('falls back to GitHub when the project has no remote and no request was read', () => {
    const project = aProject({ workspaceId: WORKSPACE.id });

    expect(hostOf({ state: stateOf({ project }), project })).toBe('github');
  });
});
