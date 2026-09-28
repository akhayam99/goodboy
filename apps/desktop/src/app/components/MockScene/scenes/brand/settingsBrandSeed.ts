import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
} from '@goodboy/types';
import { finish } from '../../../../../features/onboarding/onboarding-store';
import { useAppStore } from '../../../../../store';
import { SETTINGS_WORKSPACE_ID } from '../audit/settingsSeed';
import { BRAND_PEOPLE } from './canon';
import { seedBrandLimits } from './limitsSeed';

const DAY_MS = 24 * 60 * 60 * 1000;

const LINKED_AT = new Date(Date.now() - 12 * DAY_MS).toISOString() as IsoDateTime;

const base = (provider: string) => ({
  id: `mock-brand-binding-${provider}` as IntegrationBindingId,
  workspaceId: SETTINGS_WORKSPACE_ID,
  projectId: null,
  credentialId: `mock-brand-cred-${provider}` as IntegrationCredentialId,
  createdAt: LINKED_AT,
  updatedAt: LINKED_AT,
});

export const BRAND_BINDINGS: ReadonlyArray<IntegrationBinding> = [
  {
    ...base('linear'),
    provider: 'linear',
    config: {
      workspaceUrlKey: 'harborline',
      viewerUserId: 'mock-brand-linear-viewer',
      viewerName: BRAND_PEOPLE.owner.name,
    },
  },
  {
    ...base('jira'),
    provider: 'jira',
    config: {
      siteUrl: 'harborline.atlassian.net',
      email: 'dana@harborline.dev',
      projectKey: 'PAY',
      displayName: BRAND_PEOPLE.owner.name,
    },
  },
  {
    ...base('sentry'),
    provider: 'sentry',
    config: {
      org: 'harborline',
      project: 'payments-api',
      orgName: 'Harborline',
      projectName: 'payments-api',
    },
  },
  {
    ...base('slack'),
    provider: 'slack',
    config: {
      teamId: 'mock-brand-slack-team',
      teamName: 'Harborline',
      userId: 'mock-brand-slack-user',
      userName: BRAND_PEOPLE.owner.handle,
      followedChannels: [
        { id: 'mock-brand-channel-oncall', name: 'payments-oncall' },
        { id: 'mock-brand-channel-ledger', name: 'ledger-dev' },
      ],
      hasSelectedChannels: true,
      includePrivate: false,
      agentPolicy: { readFollowed: 'allow', readOthers: 'off', reply: 'ask', react: 'allow' },
      signature: { agents: true, own: false, text: 'via Goodboy' },
    },
  },
];

export const seedBrandSettings = (): void => {
  finish();
  seedBrandLimits();
  useAppStore.setState({
    workspaceIntegrations: { [SETTINGS_WORKSPACE_ID]: BRAND_BINDINGS },
    integrationCredentials: [],
    githubStatus: { mode: 'pat', available: true, user: 'harborline-bot', scopes: ['repo'] },
    refreshGithubStatus: async () => undefined,
  });
};
