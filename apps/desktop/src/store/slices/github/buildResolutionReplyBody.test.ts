import { describe, expect, it } from 'vitest';
import { buildResolutionReplyBody } from './buildResolutionReplyBody';

const PR_URL = 'https://github.com/o/r/pull/9';

describe('buildResolutionReplyBody', () => {
  it('returns null without a closure', () => {
    expect(buildResolutionReplyBody(undefined, PR_URL)).toBeNull();
  });

  it('labels a fix and puts the resolution below the reason', () => {
    const body = buildResolutionReplyBody(
      { commitSha: 'abc1234def', reply: 'the guard ran after the early return' },
      PR_URL,
    );
    expect(body).toBe(
      '**Valid.** the guard ran after the early return\n\n**Resolution.** Fixed in [`abc1234`](https://github.com/o/r/commit/abc1234def).',
    );
  });

  it('keeps the plain commit line when the pr url is unknown', () => {
    expect(buildResolutionReplyBody({ commitSha: 'abc1234def' }, null)).toBe(
      '**Valid.**\n\n**Resolution.** Fixed in `abc1234`.',
    );
  });

  it('labels a close and names the closing reason', () => {
    expect(
      buildResolutionReplyBody(
        { reason: 'covered elsewhere', reply: 'the sibling routes share this convention' },
        PR_URL,
      ),
    ).toBe(
      '**Not applying.** the sibling routes share this convention\n\n**Resolution.** Closed without a change: covered elsewhere',
    );
  });

  it('stands on the verdict alone when the agent wrote no reason', () => {
    expect(buildResolutionReplyBody({ reason: 'covered elsewhere' }, PR_URL)).toBe(
      '**Not applying.**\n\n**Resolution.** Closed without a change: covered elsewhere',
    );
  });

  it('posts the reply unlabelled when there is no sha and no reason', () => {
    expect(buildResolutionReplyBody({ reply: 'answered inline' }, PR_URL)).toBe('answered inline');
  });

  it('returns null when every field is blank', () => {
    expect(buildResolutionReplyBody({ reply: '   ', reason: '' }, PR_URL)).toBeNull();
  });
});
