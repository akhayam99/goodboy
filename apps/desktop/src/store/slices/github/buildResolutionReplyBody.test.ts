import { describe, expect, it } from 'vitest';
import { REPLY_SETTINGS_DEFAULT } from '../../../features/resolve/replySettings';
import { buildResolutionReplyBody } from './buildResolutionReplyBody';

const PR_URL = 'https://github.com/o/r/pull/9';
const UNSIGNED = { ...REPLY_SETTINGS_DEFAULT, isSigned: false };

describe('buildResolutionReplyBody', () => {
  it('returns null without a closure', () => {
    expect(
      buildResolutionReplyBody({ closure: undefined, prUrl: PR_URL, settings: UNSIGNED }),
    ).toBeNull();
  });

  it('fills the fixed template with the reason and a link to the commit', () => {
    const body = buildResolutionReplyBody({
      closure: { commitSha: 'abc1234def', reply: 'The guard ran after the early return.' },
      prUrl: PR_URL,
      settings: UNSIGNED,
    });
    expect(body).toBe(
      'The guard ran after the early return.\n\nFixed in [`abc1234`](https://github.com/o/r/commit/abc1234def).',
    );
  });

  it('keeps the plain commit when the pr url is unknown', () => {
    expect(
      buildResolutionReplyBody({
        closure: { commitSha: 'abc1234def' },
        prUrl: null,
        settings: UNSIGNED,
      }),
    ).toBe('Fixed in `abc1234`.');
  });

  it('fills the not changing template, with the closing reason when there is no reply', () => {
    expect(
      buildResolutionReplyBody({
        closure: { reason: 'covered elsewhere', reply: 'The sibling routes share this name.' },
        prUrl: PR_URL,
        settings: UNSIGNED,
      }),
    ).toBe('The sibling routes share this name.\n\nLeaving this as is.');
    expect(
      buildResolutionReplyBody({
        closure: { reason: 'covered elsewhere' },
        prUrl: PR_URL,
        settings: UNSIGNED,
      }),
    ).toBe('covered elsewhere\n\nLeaving this as is.');
  });

  it('renders the workspace template with the reviewer, file, line and fixup target', () => {
    expect(
      buildResolutionReplyBody({
        closure: { commitSha: '9e8d7c6aaa', reply: 'capped at 6' },
        prUrl: PR_URL,
        settings: {
          ...UNSIGNED,
          templateFixed:
            '{reviewer} {reason}, done in {commit} (fixup of {fixup_of}) {file}:{line}',
        },
        context: {
          reviewer: 'cascadia-lead',
          file: 'src/retryPolicy.ts',
          line: 42,
          fixupOfSha: '3a1f9c2bbb',
        },
      }),
    ).toBe(
      '@cascadia-lead capped at 6, done in [`9e8d7c6`](https://github.com/o/r/commit/9e8d7c6aaa) (fixup of [`3a1f9c2`](https://github.com/o/r/commit/3a1f9c2bbb)) src/retryPolicy.ts:42',
    );
  });

  it('posts the reply as written when there is no sha and no reason', () => {
    expect(
      buildResolutionReplyBody({
        closure: { reply: 'answered inline' },
        prUrl: PR_URL,
        settings: UNSIGNED,
      }),
    ).toBe('answered inline');
  });

  it('returns null when every field is blank, signed or not', () => {
    expect(
      buildResolutionReplyBody({
        closure: { reply: '   ', reason: '' },
        prUrl: PR_URL,
        settings: UNSIGNED,
      }),
    ).toBeNull();
    expect(
      buildResolutionReplyBody({ closure: { reply: '   ', reason: '' }, prUrl: PR_URL }),
    ).toBeNull();
  });

  it('signs the reply by default', () => {
    expect(buildResolutionReplyBody({ closure: { reply: 'answered inline' }, prUrl: PR_URL })).toBe(
      `answered inline\n\n*Written by Goodboy*`,
    );
  });
});
