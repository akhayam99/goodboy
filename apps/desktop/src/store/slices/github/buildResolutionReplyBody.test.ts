import { describe, expect, it } from 'vitest';
import { buildResolutionReplyBody } from './buildResolutionReplyBody';

const PR_URL = 'https://github.com/o/r/pull/9';

describe('buildResolutionReplyBody', () => {
  it('returns null without a closure', () => {
    expect(buildResolutionReplyBody(undefined, PR_URL)).toBeNull();
  });

  it('puts the agent reply above the commit line', () => {
    const body = buildResolutionReplyBody(
      { commitSha: 'abc1234def', reply: 'switched to the guard helper' },
      PR_URL,
    );
    expect(body).toBe(
      'switched to the guard helper\n\nResolved in [`abc1234`](https://github.com/o/r/commit/abc1234def).',
    );
  });

  it('keeps the plain commit line when the pr url is unknown', () => {
    expect(buildResolutionReplyBody({ commitSha: 'abc1234def' }, null)).toBe(
      'Resolved in `abc1234`.',
    );
  });

  it('puts the agent reply above the closing reason', () => {
    expect(
      buildResolutionReplyBody({ reason: 'covered elsewhere', reply: 'no change needed' }, PR_URL),
    ).toBe('no change needed\n\nClosing: covered elsewhere');
  });

  it('posts the reply alone when there is no sha and no reason', () => {
    expect(buildResolutionReplyBody({ reply: 'answered inline' }, PR_URL)).toBe('answered inline');
  });

  it('returns null when every field is blank', () => {
    expect(buildResolutionReplyBody({ reply: '   ', reason: '' }, PR_URL)).toBeNull();
  });
});
