import { describe, expect, it } from 'vitest';
import type { WorkspaceIntegration, WorkspaceIntegrationProvider } from '@goodboy/types';
import { resolveIssueSources } from './issueSources';

const integration = (provider: WorkspaceIntegrationProvider): WorkspaceIntegration =>
  ({ provider }) as WorkspaceIntegration;

describe('resolveIssueSources', () => {
  it('offers every connected source, slack included', () => {
    expect(
      resolveIssueSources({
        integrations: [integration('slack'), integration('linear')],
        remoteKind: null,
        isGithubAuthenticated: false,
      }).map((source) => source.label),
    ).toEqual(['Linear', 'Slack']);
  });

  it('never offers bitbucket, which tracks no issues of its own', () => {
    expect(
      resolveIssueSources({
        integrations: [integration('bitbucket'), integration('jira')],
        remoteKind: null,
        isGithubAuthenticated: false,
      }).map((source) => source.provider),
    ).toEqual(['jira']);
  });

  it('leaves slack out until the workspace connects it', () => {
    expect(
      resolveIssueSources({
        integrations: [integration('linear')],
        remoteKind: null,
        isGithubAuthenticated: false,
      }).map((source) => source.provider),
    ).toEqual(['linear']);
  });
});
