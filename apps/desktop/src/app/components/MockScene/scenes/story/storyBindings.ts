import {
  brandId,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type IsoDateTime,
  type WorkspaceId,
} from '@goodboy/types';
import { linearBindingOf } from '../brand/kickoffIssues';
import { STORY_SLACK_CHANNELS } from './storyTasks';

type BaseParams = {
  readonly workspaceId: WorkspaceId;
  readonly tool: string;
};

const baseOf = ({ workspaceId, tool }: BaseParams) => {
  const at = brandId<IsoDateTime>({ value: new Date().toISOString() });
  return {
    id: brandId<IntegrationBindingId>({ value: `demo-story-binding-${tool}` }),
    workspaceId,
    projectId: null,
    credentialId: brandId<IntegrationCredentialId>({ value: `demo-story-credential-${tool}` }),
    createdAt: at,
    updatedAt: at,
  };
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly hasLinear: boolean;
};

export const storyBindingsOf = ({
  workspaceId,
  hasLinear,
}: Params): ReadonlyArray<IntegrationBinding> => [
  {
    ...baseOf({ workspaceId, tool: 'gitlab' }),
    provider: 'gitlab',
    config: { userName: 'dana-r', userId: 'demo-story-gitlab-dana', host: 'gitlab.com' },
  },
  {
    ...baseOf({ workspaceId, tool: 'sentry' }),
    provider: 'sentry',
    config: {
      org: 'harborline',
      project: 'payments-api',
      orgName: 'Harborline',
      projectName: 'payments-api',
    },
  },
  {
    ...baseOf({ workspaceId, tool: 'slack' }),
    provider: 'slack',
    config: {
      teamId: 'demo-story-team',
      teamName: 'Harborline',
      userId: 'demo-story-user-dana',
      userName: 'dana-r',
      followedChannels: STORY_SLACK_CHANNELS.map(({ id, name }) => ({ id, name })),
      hasSelectedChannels: false,
      includePrivate: false,
      agentPolicy: { readFollowed: 'allow', readOthers: 'off', reply: 'ask', react: 'ask' },
      signature: { agents: true, own: false, text: '' },
    },
  },
  ...(hasLinear ? [linearBindingOf({ workspaceId })] : []),
];
