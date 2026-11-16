import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type IsoDateTime,
  type WorkspaceId,
} from '@goodboy/types';
import { selectFollowedChannelCount } from './selectFollowedChannelCount';

const HARBORLINE = brandId<WorkspaceId>({ value: 'harborline' });
const CREATED_AT = brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' });

const SLACK: IntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-slack' }),
  workspaceId: HARBORLINE,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'cred-slack' }),
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  provider: 'slack',
  config: {
    teamId: 'T1',
    teamName: 'Harborline',
    userId: 'U1',
    userName: 'Mara Quint',
    followedChannels: [
      { id: 'C1', name: 'payments' },
      { id: 'C2', name: 'ledger' },
    ],
    hasSelectedChannels: true,
    includePrivate: false,
    agentPolicy: { readFollowed: 'allow', readOthers: 'off', reply: 'allow', react: 'allow' },
    signature: { agents: true, own: false, text: 'Sent by an agent' },
  },
};

describe('selectFollowedChannelCount', () => {
  it('counts the channels the Slack binding of the workspace follows', () => {
    const state = { workspaceIntegrations: { [HARBORLINE]: [SLACK] } };
    expect(selectFollowedChannelCount({ state, workspaceId: HARBORLINE })).toBe(2);
  });

  it('is unknown when Slack is not connected in that workspace', () => {
    const state = { workspaceIntegrations: {} };
    expect(selectFollowedChannelCount({ state, workspaceId: HARBORLINE })).toBeNull();
  });
});
