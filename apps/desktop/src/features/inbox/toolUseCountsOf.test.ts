// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { toolUseCountsOf } from './toolUseCountsOf';

describe('toolUseCountsOf', () => {
  it('counts the open records of each tool by what they are, the way Tasks counts open', () => {
    const counts = toolUseCountsOf({
      settled: ['github', 'gitlab', 'slack'],
      records: [
        { provider: 'github', state: 'open', payload: { kind: 'pr', role: 'author' } },
        { provider: 'github', state: 'active', payload: { kind: 'pr', role: 'author' } },
        { provider: 'github', state: 'done', payload: { kind: 'pr', role: 'author' } },
        { provider: 'github', state: 'open', payload: { kind: 'pr', role: 'review-requested' } },
        { provider: 'github', state: 'alert', payload: { kind: 'issue' } },
        { provider: 'gitlab', state: 'open', payload: { kind: 'mr' } },
        { provider: 'slack', state: 'open', payload: { kind: 'thread' } },
      ],
    });

    expect(counts).toEqual({
      github: { pullRequests: 2, reviews: 1, issues: 1 },
      gitlab: { mergeRequests: 1, issues: 0 },
      slack: { threads: 1 },
    });
  });

  it('leaves out a tool that is still loading or failed, so its count stays unknown', () => {
    const counts = toolUseCountsOf({
      settled: ['linear'],
      records: [{ provider: 'jira', state: 'open', payload: { kind: 'issue' } }],
    });

    expect(counts).toEqual({ linear: { issues: 0 } });
  });

  it('counts a Sentry error as an issue and a Bitbucket pull request as a pull request', () => {
    const counts = toolUseCountsOf({
      settled: ['sentry', 'bitbucket'],
      records: [
        { provider: 'sentry', state: 'alert', payload: { kind: 'error' } },
        { provider: 'bitbucket', state: 'open', payload: { kind: 'pr' } },
      ],
    });

    expect(counts).toEqual({ sentry: { issues: 1 }, bitbucket: { pullRequests: 1 } });
  });
});
