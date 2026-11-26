import { describe, expect, it } from 'vitest';
import { storyIpcAnswer } from './storyIpc';
import {
  STORY_EXAMPLE_KEY,
  STORY_SLACK_CHANNELS,
  storyGithubIssues,
  storyGithubPrs,
  storyGitlabMrs,
  storyKnownTaskKeys,
  storyLinearIssues,
  storySentryIssues,
  storySlackHeads,
} from './storyTasks';

const SOURCES = {
  linear: storyLinearIssues().length,
  github: storyGithubPrs().length + storyGithubIssues().length,
  gitlab: storyGitlabMrs().length,
  sentry: storySentryIssues().length,
  slack: STORY_SLACK_CHANNELS.flatMap(({ id }) => storySlackHeads({ channelId: id })).length,
};

describe('the Harborline task seed', () => {
  it('mixes five sources', () => {
    expect(Object.keys(SOURCES)).toHaveLength(5);
    expect(Object.values(SOURCES).every((count) => count > 0)).toBe(true);
  });

  it('holds eleven items with the duplicate credit bug first', () => {
    expect(Object.values(SOURCES).reduce((total, count) => total + count, 0)).toBe(11);
    expect(storyLinearIssues().map((issue) => issue.identifier)).toEqual([
      'HBL-412',
      'HBL-409',
      'HBL-397',
    ]);
    expect(storyLinearIssues()[0]).toMatchObject({
      title: 'Retried webhooks post a second credit',
      priorityLabel: 'Urgent',
      state: { name: 'Todo' },
    });
  });

  it('names the Sentry error and the other items of the plan', () => {
    expect(storySentryIssues().map((issue) => issue.shortId)).toEqual([
      'PAY-API-7K1',
      'LED-CORE-3QD',
    ]);
    expect(storySentryIssues()[0]).toMatchObject({ count: '42', userCount: 9 });
    expect(storyGitlabMrs().map((mr) => mr.iid)).toEqual([44, 41]);
  });

  it('leaves the Sentry error and the payments thread out of the known keys so they read as new', () => {
    const known = storyKnownTaskKeys();
    expect(known).toHaveLength(11 - 2);
    expect(known).not.toContain('sentry:error:7001');
    expect(known.some((key) => key.startsWith('slack:thread:demo-story-channel-payments'))).toBe(
      false,
    );
  });

  it('keeps acme-web and Cascadia out of every answer', () => {
    const text = JSON.stringify([
      storyLinearIssues(),
      storyGithubPrs(),
      storyGithubIssues(),
      storyGitlabMrs(),
      storySentryIssues(),
      STORY_SLACK_CHANNELS,
    ]).toLowerCase();
    expect(text).not.toContain('acme');
    expect(text).not.toContain('cascadia');
  });
});

describe('the Linear key check', () => {
  it('answers the example key with dana on the harborline workspace', () => {
    expect(
      storyIpcAnswer({
        command: 'linear_validate_connection',
        payload: { credentialId: 'demo', token: STORY_EXAMPLE_KEY },
      }),
    ).toMatchObject({ email: 'dana@harborline.dev', organization: { urlKey: 'harborline' } });
  });

  it('refuses any other key', () => {
    expect(() =>
      storyIpcAnswer({
        command: 'linear_validate_connection',
        payload: { credentialId: 'demo', token: 'lin_api_something_else' },
      }),
    ).toThrow('Linear did not accept that API key');
  });
});
