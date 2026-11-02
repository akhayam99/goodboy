import { describe, expect, it } from 'vitest';
import {
  brandId,
  type BitbucketIntegrationBinding,
  type GitlabIntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type IsoDateTime,
  type WorkspaceId,
} from '@goodboy/types';
import { identityHealthOf } from './identityHealthOf';

const BASE = {
  id: brandId<IntegrationBindingId>({ value: 'binding-harborline' }),
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-1' }),
  createdAt: brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' }),
  updatedAt: brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' }),
};

const gitlabOf = ({ username }: { readonly username?: string }): GitlabIntegrationBinding => ({
  ...BASE,
  provider: 'gitlab',
  config: { userName: 'Harborline Dev', userId: '3', host: 'gitlab.com', username },
});

const bitbucketOf = ({
  nickname,
}: {
  readonly nickname?: string;
}): BitbucketIntegrationBinding => ({
  ...BASE,
  provider: 'bitbucket',
  config: { workspaceSlug: 'northwind', email: 'dev@northwind.test', nickname },
});

describe('identityHealthOf', () => {
  it('names the missing GitLab username with one line and one action', () => {
    expect(identityHealthOf({ binding: gitlabOf({}) })).toEqual({
      isMissing: true,
      copy: 'Unread needs your username.',
      action: 'Reconnect',
    });
  });

  it('names the missing Bitbucket nickname the same way', () => {
    expect(identityHealthOf({ binding: bitbucketOf({}) }).isMissing).toBe(true);
  });

  it('is healthy once the name is stored, and when there is no connection', () => {
    expect(identityHealthOf({ binding: gitlabOf({ username: 'nadia-p' }) }).isMissing).toBe(false);
    expect(identityHealthOf({ binding: bitbucketOf({ nickname: 'nadia-p' }) }).isMissing).toBe(
      false,
    );
    expect(identityHealthOf({ binding: null }).isMissing).toBe(false);
  });
});
