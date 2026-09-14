import { describe, expect, it } from 'vitest';
import type { IntegrationBinding, WorkspaceIntegrationProvider } from '@goodboy/types';
import { issueSourcesOfKind, resolveIssueSources } from './issueSources';

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

  it('keeps the unfiltered catalogue and its order untouched', () => {
    expect(
      resolveIssueSources({
        integrations: [
          integration('slack'),
          integration('sentry'),
          integration('jira'),
          integration('gitlab'),
          integration('linear'),
          integration('bitbucket'),
        ],
        isGithubAuthenticated: true,
      }).map((source) => source.provider),
    ).toEqual(['linear', 'github', 'gitlab', 'jira', 'sentry', 'slack']);
  });

  it('offers sentry to an issue-only surface', () => {
    expect(
      resolveIssueSources({
        integrations: [integration('sentry')],
        isGithubAuthenticated: false,
        kinds: ['issue'],
      }).map((source) => source.label),
    ).toEqual(['Sentry']);
  });

  it('drops slack and bitbucket from an issue-only surface even when connected', () => {
    expect(
      resolveIssueSources({
        integrations: [
          integration('slack'),
          integration('bitbucket'),
          integration('sentry'),
          integration('linear'),
        ],
        isGithubAuthenticated: false,
        kinds: ['issue'],
      }).map((source) => source.provider),
    ).toEqual(['linear', 'sentry']);
  });
});

describe('issueSourcesOfKind', () => {
  it('names every tracker an issue surface can offer', () => {
    expect(issueSourcesOfKind({ kinds: ['issue'] }).map((source) => source.label)).toEqual([
      'Linear',
      'GitHub',
      'GitLab',
      'Jira',
      'Sentry',
    ]);
  });

  it('keeps slack on the thread kind, away from issue surfaces', () => {
    expect(issueSourcesOfKind({ kinds: ['thread'] }).map((source) => source.provider)).toEqual([
      'slack',
    ]);
  });
});
