import {
  brandId,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
} from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../../../../shared/components/IntegrationGlyph';
import { useAppStore } from '../../../../../store';
import { WORKSPACE_ID } from '../BoardScene';
import { payloadString } from '../audit/ipcPayload';
import { mockSceneIpc } from '../mockSceneIpc';
import { seedPolicyScene } from '../providerPolicySeed';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-11-15T10:12:00.000Z' });
const AT = clock.iso({ at: '2026-11-01T08:00:00.000Z' });
const MISSING_KEY = 'mock-connections-cred-gitlab';

const SLACK_CHANNELS = [
  { id: 'C-payments', name: 'payments', isMember: true, topic: null, memberCount: 18 },
  { id: 'C-ledger', name: 'ledger', isMember: true, topic: null, memberCount: 9 },
  { id: 'C-incidents', name: 'incidents', isMember: true, topic: null, memberCount: 31 },
  { id: 'C-releases', name: 'releases', isMember: true, topic: null, memberCount: 24 },
  { id: 'C-design', name: 'design', isMember: true, topic: null, memberCount: 12 },
];

type BindingParams = {
  readonly provider: IntegrationBinding['provider'];
};

const ids = ({ provider }: BindingParams) => ({
  id: brandId<IntegrationBindingId>({ value: `mock-connections-binding-${provider}` }),
  workspaceId: WORKSPACE_ID,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: `mock-connections-cred-${provider}` }),
  createdAt: AT,
  updatedAt: AT,
});

const BINDINGS: ReadonlyArray<IntegrationBinding> = [
  {
    ...ids({ provider: 'gitlab' }),
    provider: 'gitlab',
    config: {
      userName: 'Platform Lead',
      username: 'platform-lead',
      userId: '42',
      host: 'https://gitlab.northwind.dev',
    },
  },
  {
    ...ids({ provider: 'linear' }),
    provider: 'linear',
    config: {
      workspaceUrlKey: 'harborline',
      viewerUserId: 'mock-viewer',
      viewerName: 'Mara Quint',
    },
  },
  {
    ...ids({ provider: 'bitbucket' }),
    provider: 'bitbucket',
    config: {
      workspaceSlug: 'harborline',
      workspaceName: 'Harborline',
      email: 'mara@harborline.dev',
      displayName: 'Mara Quint',
    },
  },
  {
    ...ids({ provider: 'sentry' }),
    provider: 'sentry',
    config: {
      org: 'harborline',
      orgName: 'Harborline',
      project: 'payments-api',
      projectName: 'payments-api',
    },
  },
  {
    ...ids({ provider: 'slack' }),
    provider: 'slack',
    config: {
      teamId: 'T-harborline',
      teamName: 'Harborline',
      userId: 'U-mara',
      userName: 'Mara Quint',
      followedChannels: [
        { id: 'C-payments', name: 'payments' },
        { id: 'C-ledger', name: 'ledger' },
        { id: 'C-incidents', name: 'incidents' },
        { id: 'C-releases', name: 'releases' },
      ],
      hasSelectedChannels: true,
      includePrivate: false,
      agentPolicy: { readFollowed: 'allow', readOthers: 'off', reply: 'allow', react: 'allow' },
      signature: { agents: true, own: false, text: 'Sent by a Goodboy agent' },
    },
  },
];

type SeedParams = {
  readonly tool: IntegrationGlyphProvider;
};

export const seedConnectionsTool = ({ tool }: SeedParams): void => {
  seedPolicyScene({ workspaceId: WORKSPACE_ID });
  useAppStore.setState({
    workspaceIntegrations: { [WORKSPACE_ID]: BINDINGS },
    integrationCredentials: [],
    githubStatus: {
      mode: 'pat',
      available: true,
      user: 'harborline-bot',
      scopes: ['repo'],
    },
    toolUseCounts: {
      [WORKSPACE_ID]: {
        github: { pullRequests: 6, reviews: 3, issues: 12 },
        gitlab: { mergeRequests: 2, issues: 5 },
        bitbucket: { pullRequests: 3 },
        linear: { issues: 8 },
        sentry: { issues: 4 },
        slack: { threads: 7 },
      },
    },
  });
  mockSceneIpc((command, payload) => {
    if (command === 'integration_credential_has_secret') {
      return payloadString({ payload, key: 'credentialId' }) !== MISSING_KEY;
    }
    if (command === 'slack_list_channels') {
      return SLACK_CHANNELS;
    }
    return undefined;
  });
  useAppStore
    .getState()
    .openStudio({ studio: { kind: 'connections', focus: { kind: 'tool', tool } } });
};
