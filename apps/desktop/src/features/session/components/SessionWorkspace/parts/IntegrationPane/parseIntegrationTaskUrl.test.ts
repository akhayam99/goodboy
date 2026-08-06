import { describe, expect, it } from 'vitest';
import { slackThreadExternalId } from '../../../../../integrations/slack/threadFormulas';
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

describe('parseIntegrationTaskUrl for slack', () => {
  it('converts the p-format permalink timestamp back into an api thread_ts', () => {
    expect(
      parseIntegrationTaskUrl({
        provider: 'slack',
        rawUrl: 'https://acme.slack.com/archives/C024BE7LR/p1723456789123456',
      }),
    ).toMatchObject({
      externalId: 'C024BE7LR:1723456789.123456',
      identifier: '#C024BE7LR',
    });
  });

  it('prefers the parent thread_ts so a reply permalink links the thread', () => {
    expect(
      parseIntegrationTaskUrl({
        provider: 'slack',
        rawUrl:
          'https://acme.slack.com/archives/C024BE7LR/p1723499999000200?thread_ts=1723456789.123456&cid=C024BE7LR',
      })?.externalId,
    ).toBe('C024BE7LR:1723456789.123456');
  });

  it('emits the same external id the studio path writes for the same thread', () => {
    const pasted = parseIntegrationTaskUrl({
      provider: 'slack',
      rawUrl: 'https://acme.slack.com/archives/C024BE7LR/p1723456789123456',
    });

    expect(pasted?.externalId).toBe(
      slackThreadExternalId({ channelId: 'C024BE7LR', threadTs: '1723456789.123456' }),
    );
  });

  it('falls back to the trailing segment when the url is not a message permalink', () => {
    expect(
      parseIntegrationTaskUrl({
        provider: 'slack',
        rawUrl: 'https://acme.slack.com/archives/C024BE7LR',
      })?.externalId,
    ).toBe('https://acme.slack.com/archives/C024BE7LR');
  });
});
