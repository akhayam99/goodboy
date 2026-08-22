import { describe, expect, it } from 'vitest';
import type {
  IntegrationCredentialId,
  IsoDateTime,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationConfig,
  WorkspaceIntegrationId,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';
import { describeIntegrationConfig } from './describeIntegrationConfig';

const WS = 'workspace-app-web' as WorkspaceId;

type Params = {
  readonly provider: WorkspaceIntegrationProvider;
  readonly config: WorkspaceIntegrationConfig;
};

const integration = ({ provider, config }: Params): WorkspaceIntegration =>
  ({
    id: 'integration-1' as WorkspaceIntegrationId,
    workspaceId: WS,
    provider,
    config,
    credentialId: `goodboy.workspace.${WS}.${provider}` as IntegrationCredentialId,
    createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
    updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  }) as WorkspaceIntegration;

describe('describeIntegrationConfig', () => {
  it('names the Linear account and workspace', () => {
    const description = describeIntegrationConfig({
      integration: integration({
        provider: 'linear',
        config: { workspaceUrlKey: 'serenis', viewerUserId: 'user-1', viewerName: 'Amin Khayam' },
      }),
    });

    expect(description).toBe('Amin Khayam on linear.app/serenis');
  });

  it('names the Sentry organization and project the reuse would bring along', () => {
    const description = describeIntegrationConfig({
      integration: integration({
        provider: 'sentry',
        config: { org: 'serenis', project: 'app-web', orgName: 'Serenis', projectName: 'App Web' },
      }),
    });

    expect(description).toBe('Serenis / App Web');
  });

  it('falls back to Sentry slugs when the human names were never fetched', () => {
    const description = describeIntegrationConfig({
      integration: integration({
        provider: 'sentry',
        config: { org: 'serenis', project: 'app-web' },
      }),
    });

    expect(description).toBe('serenis / app-web');
  });

  it('names the GitLab user and host, so a self-hosted instance is visible', () => {
    const description = describeIntegrationConfig({
      integration: integration({
        provider: 'gitlab',
        config: { userName: 'octo', userId: '42', host: 'https://gitlab.serenis.it' },
      }),
    });

    expect(description).toBe('octo on https://gitlab.serenis.it');
  });

  it('names the Jira project, because the reuse carries that project with it', () => {
    const description = describeIntegrationConfig({
      integration: integration({
        provider: 'jira',
        config: {
          siteUrl: 'https://acme.atlassian.net',
          email: 'grace@acme.com',
          projectKey: 'ENG',
          displayName: 'Grace Hopper',
        },
      }),
    });

    expect(description).toBe('ENG on https://acme.atlassian.net as Grace Hopper');
  });

  it('falls back to the Jira account email when no display name is stored', () => {
    const description = describeIntegrationConfig({
      integration: integration({
        provider: 'jira',
        config: {
          siteUrl: 'https://acme.atlassian.net',
          email: 'grace@acme.com',
          projectKey: 'ENG',
        },
      }),
    });

    expect(description).toBe('ENG on https://acme.atlassian.net as grace@acme.com');
  });

  it('names the Bitbucket workspace and account', () => {
    const description = describeIntegrationConfig({
      integration: integration({
        provider: 'bitbucket',
        config: {
          workspaceSlug: 'serenis',
          email: 'grace@acme.com',
          displayName: 'Grace Hopper',
        },
      }),
    });

    expect(description).toBe('bitbucket.org/serenis as Grace Hopper');
  });

  it('names the Slack team and the person the token belongs to', () => {
    const description = describeIntegrationConfig({
      integration: integration({
        provider: 'slack',
        config: { teamId: 'T1', teamName: 'Serenis', botUserId: 'U1', botUserName: 'goodboy' },
      }),
    });

    expect(description).toBe('Serenis as goodboy');
  });
});
