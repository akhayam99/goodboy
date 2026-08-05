import { describe, expect, it } from 'vitest';
import { parseIntegrationTaskUrl } from './parseIntegrationTaskUrl';

describe('parseIntegrationTaskUrl for bitbucket', () => {
  it('reads the workspace, repository and number out of a pull request url', () => {
    expect(
      parseIntegrationTaskUrl({
        provider: 'bitbucket',
        rawUrl: 'https://bitbucket.org/acme/rocket/pull-requests/42',
      }),
    ).toMatchObject({
      externalId: 'acme/rocket#42',
      identifier: 'acme/rocket#42',
      url: 'https://bitbucket.org/acme/rocket/pull-requests/42',
    });
  });

  it('does not claim a nested path that only ends in a pull request number', () => {
    const parsed = parseIntegrationTaskUrl({
      provider: 'bitbucket',
      rawUrl: 'https://bitbucket.org/acme/rocket/pipelines/pull-requests/42',
    });
    expect(parsed?.identifier).toBe('42');
  });

  it('does not claim the new-pull-request form as pull request "new"', () => {
    const parsed = parseIntegrationTaskUrl({
      provider: 'bitbucket',
      rawUrl: 'https://bitbucket.org/acme/rocket/pull-requests/new',
    });
    expect(parsed?.identifier).toBe('new');
  });

  it('does not claim a repository-level pull request list', () => {
    const parsed = parseIntegrationTaskUrl({
      provider: 'bitbucket',
      rawUrl: 'https://bitbucket.org/acme/rocket/pull-requests',
    });
    expect(parsed?.identifier).toBe('pull-requests');
  });
});
