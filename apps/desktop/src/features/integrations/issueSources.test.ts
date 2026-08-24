import { describe, expect, it } from 'vitest';
import type { IntegrationBinding, WorkspaceIntegrationProvider } from '@goodboy/types';
import { resolveIssueSources } from './issueSources';

const integration = (provider: WorkspaceIntegrationProvider): IntegrationBinding =>
  ({ provider }) as IntegrationBinding;

describe('resolveIssueSources', () => {
  it('offers every connected source, slack included', () => {
    expect(
      resolveIssueSources({
        integrations: [integration('slack'), integration('linear')],
        isGithubAuthenticated: false,
      }).map((source) => source.label),
    ).toEqual(['Linear', 'Slack']);
  });

  it('never offers bitbucket, which tracks no issues of its own', () => {
    expect(
      resolveIssueSources({
        integrations: [integration('bitbucket'), integration('jira')],
        isGithubAuthenticated: false,
      }).map((source) => source.provider),
    ).toEqual(['jira']);
  });

  it('keeps GitHub in the picker when a GitLab credential is the only integration', () => {
    expect(
      resolveIssueSources({
        integrations: [integration('gitlab')],
        isGithubAuthenticated: true,
      }).map((source) => source.provider),
    ).toEqual(['github', 'gitlab']);
  });

  it('leaves slack out until the workspace connects it', () => {
    expect(
      resolveIssueSources({
        integrations: [integration('linear')],
        isGithubAuthenticated: false,
      }).map((source) => source.provider),
    ).toEqual(['linear']);
  });
});
