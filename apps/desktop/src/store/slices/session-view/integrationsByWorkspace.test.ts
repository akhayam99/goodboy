// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type BitbucketIntegrationBinding,
  type GitlabIntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
} from '@goodboy/types';
import { aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import { integrationsByWorkspace } from './integrationsByWorkspace';

const HARBORLINE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const NORTHWIND = aWorkspace({ name: 'Northwind', slug: 'northwind' });

const GITLAB: GitlabIntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-gitlab' }),
  workspaceId: HARBORLINE.id,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-gitlab' }),
  provider: 'gitlab',
  config: { host: 'gitlab.com', userName: 'kenji-w', userId: '7' },
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

const BITBUCKET: BitbucketIntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-bitbucket' }),
  workspaceId: NORTHWIND.id,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-bitbucket' }),
  provider: 'bitbucket',
  config: { workspaceSlug: 'northwind', email: 'nadia@northwind.test' },
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

describe('integrationsByWorkspace', () => {
  it('groups bindings under the workspace that owns them', () => {
    expect(integrationsByWorkspace({ bindings: [GITLAB, BITBUCKET] })).toEqual({
      [HARBORLINE.id]: [GITLAB],
      [NORTHWIND.id]: [BITBUCKET],
    });
  });

  it('is empty when there are no bindings', () => {
    expect(integrationsByWorkspace({ bindings: [] })).toEqual({});
  });
});
