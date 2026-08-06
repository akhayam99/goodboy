import { describe, expect, it } from 'vitest';
import type {
  SessionExternalTask,
  WorkspaceIntegration,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';
import { resolveIntegrationConnection } from './connection';

type IntegrationParams = {
  readonly provider: WorkspaceIntegrationProvider;
};

type TaskParams = {
  readonly provider: SessionExternalTask['provider'];
};

const integration = ({ provider }: IntegrationParams): WorkspaceIntegration =>
  ({ provider }) as WorkspaceIntegration;

const task = ({ provider }: TaskParams): SessionExternalTask =>
  ({ provider }) as SessionExternalTask;

describe('resolveIntegrationConnection', () => {
  it('distinguishes connected, linked-only, and unavailable integrations', () => {
    const connected = resolveIntegrationConnection({
      provider: 'linear',
      integrations: [integration({ provider: 'linear' })],
      remoteKind: 'other',
      externalTasks: [],
      isGithubAuthenticated: false,
    });
    const linkedOnly = resolveIntegrationConnection({
      provider: 'sentry',
      integrations: [],
      remoteKind: 'other',
      externalTasks: [task({ provider: 'sentry' })],
      isGithubAuthenticated: false,
    });
    const jiraConnected = resolveIntegrationConnection({
      provider: 'jira',
      integrations: [integration({ provider: 'jira' })],
      remoteKind: 'other',
      externalTasks: [],
      isGithubAuthenticated: false,
    });
    const unavailable = resolveIntegrationConnection({
      provider: 'gitlab',
      integrations: [],
      remoteKind: 'github',
      externalTasks: [],
      isGithubAuthenticated: false,
    });

    expect({ connected, linkedOnly, jiraConnected, unavailable }).toEqual({
      connected: { isConnected: true, isAvailable: true },
      linkedOnly: { isConnected: false, isAvailable: true },
      jiraConnected: { isConnected: true, isAvailable: true },
      unavailable: { isConnected: false, isAvailable: false },
    });
  });

  it('uses workspace remotes for pull request and GitHub availability', () => {
    const github = resolveIntegrationConnection({
      provider: 'github',
      integrations: [],
      remoteKind: 'github',
      externalTasks: [],
      isGithubAuthenticated: true,
    });
    const gitlabPr = resolveIntegrationConnection({
      provider: 'pr',
      integrations: [integration({ provider: 'gitlab' })],
      remoteKind: 'gitlab',
      externalTasks: [],
      isGithubAuthenticated: false,
    });

    expect({ github, gitlabPr }).toEqual({
      github: { isConnected: true, isAvailable: true },
      gitlabPr: { isConnected: true, isAvailable: true },
    });
  });

  it('connects bitbucket from the workspace integration alone, whatever the remote is', () => {
    const connected = resolveIntegrationConnection({
      provider: 'bitbucket',
      integrations: [integration({ provider: 'bitbucket' })],
      remoteKind: 'other',
      externalTasks: [],
      isGithubAuthenticated: false,
    });
    const missing = resolveIntegrationConnection({
      provider: 'bitbucket',
      integrations: [],
      remoteKind: 'other',
      externalTasks: [],
      isGithubAuthenticated: false,
    });

    expect({ connected, missing }).toEqual({
      connected: { isConnected: true, isAvailable: true },
      missing: { isConnected: false, isAvailable: false },
    });
  });

  it('does not treat a GitHub remote as an authenticated connection', () => {
    const github = resolveIntegrationConnection({
      provider: 'github',
      integrations: [],
      remoteKind: 'github',
      externalTasks: [],
      isGithubAuthenticated: false,
    });

    expect(github).toEqual({ isConnected: false, isAvailable: false });
  });
});
