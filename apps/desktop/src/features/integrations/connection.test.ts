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
      externalTasks: [],
      isGithubAuthenticated: false,
    });
    const linkedOnly = resolveIntegrationConnection({
      provider: 'sentry',
      integrations: [],
      externalTasks: [task({ provider: 'sentry' })],
      isGithubAuthenticated: false,
    });
    const jiraConnected = resolveIntegrationConnection({
      provider: 'jira',
      integrations: [integration({ provider: 'jira' })],
      externalTasks: [],
      isGithubAuthenticated: false,
    });
    const unavailable = resolveIntegrationConnection({
      provider: 'gitlab',
      integrations: [],
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

  it('connects GitHub and GitLab from credentials alone, whatever the remote is', () => {
    const github = resolveIntegrationConnection({
      provider: 'github',
      integrations: [integration({ provider: 'gitlab' })],
      externalTasks: [],
      isGithubAuthenticated: true,
    });
    const gitlab = resolveIntegrationConnection({
      provider: 'gitlab',
      integrations: [integration({ provider: 'gitlab' })],
      externalTasks: [],
      isGithubAuthenticated: true,
    });
    const bothHostsPr = resolveIntegrationConnection({
      provider: 'pr',
      integrations: [integration({ provider: 'gitlab' })],
      externalTasks: [],
      isGithubAuthenticated: true,
    });

    expect({ github, gitlab, bothHostsPr }).toEqual({
      github: { isConnected: true, isAvailable: true },
      gitlab: { isConnected: true, isAvailable: true },
      bothHostsPr: { isConnected: true, isAvailable: true },
    });
  });

  it('connects the pull request surface from a GitLab credential with no GitLab remote', () => {
    const gitlabPr = resolveIntegrationConnection({
      provider: 'pr',
      integrations: [integration({ provider: 'gitlab' })],
      externalTasks: [],
      isGithubAuthenticated: false,
    });

    expect(gitlabPr).toEqual({ isConnected: true, isAvailable: true });
  });

  it('connects bitbucket from the workspace integration alone, whatever the remote is', () => {
    const connected = resolveIntegrationConnection({
      provider: 'bitbucket',
      integrations: [integration({ provider: 'bitbucket' })],
      externalTasks: [],
      isGithubAuthenticated: false,
    });
    const missing = resolveIntegrationConnection({
      provider: 'bitbucket',
      integrations: [],
      externalTasks: [],
      isGithubAuthenticated: false,
    });

    expect({ connected, missing }).toEqual({
      connected: { isConnected: true, isAvailable: true },
      missing: { isConnected: false, isAvailable: false },
    });
  });

  it('leaves GitHub disconnected without a credential, remote or not', () => {
    const github = resolveIntegrationConnection({
      provider: 'github',
      integrations: [],
      externalTasks: [],
      isGithubAuthenticated: false,
    });

    expect(github).toEqual({ isConnected: false, isAvailable: false });
  });
});
