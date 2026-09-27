import { describe, expect, it } from 'vitest';
import { REDACTED } from './redactSecrets';
import { collapseHomePaths, REDACTED_EMAIL, redactReportText } from './redactReportText';

describe('collapseHomePaths', () => {
  it('shortens macOS, linux and windows home folders to a tilde', () => {
    expect(collapseHomePaths({ text: 'open /Users/dev/.goodboy/data.db failed' })).toBe(
      'open ~/.goodboy/data.db failed',
    );
    expect(collapseHomePaths({ text: 'at /home/dev/app/boot.ts:4' })).toBe('at ~/app/boot.ts:4');
    expect(collapseHomePaths({ text: 'C:\\Users\\dev\\AppData\\goodboy' })).toBe(
      '~\\AppData\\goodboy',
    );
  });

  it('leaves a path outside a home folder alone', () => {
    expect(collapseHomePaths({ text: 'at /opt/goodboy/App.tsx' })).toBe('at /opt/goodboy/App.tsx');
  });
});

describe('redactReportText', () => {
  it('removes opaque tokens', () => {
    const text = redactReportText({
      text: 'gh ghp_AbCdEfGhIjKlMnOpQrSt1234 slack xoxb-1234567890-abcdef anthropic sk-ant-api03-AbCdEfGhIjKlMnOp',
    });

    expect(text).not.toContain('ghp_AbCd');
    expect(text).not.toContain('xoxb-1234');
    expect(text).not.toContain('sk-ant-api03');
    expect(text).toContain(REDACTED);
  });

  it('removes labelled secrets', () => {
    const text = redactReportText({
      text: 'fetch failed: Authorization: Bearer abcdefghijklmnop, password=hunter2hunter2',
    });

    expect(text).not.toContain('abcdefghijklmnop');
    expect(text).not.toContain('hunter2hunter2');
  });

  it('collapses home paths', () => {
    const text = redactReportText({ text: 'spawn codex cwd=/Users/rowan/code/harborline' });

    expect(text).toBe('spawn codex cwd=~/code/harborline');
  });

  it('removes email addresses', () => {
    const text = redactReportText({ text: 'git author rowan.lee+ci@example.dev rejected' });

    expect(text).toBe(`git author ${REDACTED_EMAIL} rejected`);
  });

  it('keeps host and path of a link but drops its query and fragment', () => {
    const text = redactReportText({
      text: 'GET https://api.github.com/graphql?access_token=abc123def456&x=1#frag failed',
    });

    expect(text).toBe('GET https://api.github.com/graphql failed');
  });

  it('drops credentials embedded in a link', () => {
    const text = redactReportText({
      text: 'clone https://rowan:s3cr3tpass@github.com/acme/ledger-core.git failed',
    });

    expect(text).toBe('clone https://github.com/acme/ledger-core.git failed');
  });

  it('leaves plain text alone', () => {
    expect(redactReportText({ text: 'migration 164 failed' })).toBe('migration 164 failed');
  });
});
