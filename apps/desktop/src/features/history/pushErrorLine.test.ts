// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pushErrorLine } from './pushErrorLine';

describe('pushErrorLine', () => {
  it('returns nothing for an empty or blank message', () => {
    expect(pushErrorLine({ message: '' })).toBe('');
    expect(pushErrorLine({ message: ' \n\n  ' })).toBe('');
  });

  it('keeps a one-line error as it is', () => {
    expect(pushErrorLine({ message: 'remote unreachable' })).toBe('remote unreachable');
  });

  it('skips hints and the generic failed-to-push line for the real cause', () => {
    const message = [
      'To https://example.com/acme/payments-api.git',
      ' ! [rejected]        hl/fix -> hl/fix (stale info)',
      "error: failed to push some refs to 'https://example.com/acme/payments-api.git'",
      'hint: Updates were rejected because the tip is behind',
    ].join('\n');

    expect(pushErrorLine({ message })).toBe('[rejected]        hl/fix -> hl/fix (stale info)');
  });

  it('strips every remote prefix and names a protected branch', () => {
    const message = [
      'remote: Resolving deltas: 100% (3/3), completed',
      'remote: error: GH006: Protected branch update failed for refs/heads/main.',
      'To https://example.com/acme/payments-api.git',
    ].join('\n');

    expect(pushErrorLine({ message })).toBe(
      'error: GH006: Protected branch update failed for refs/heads/main.',
    );
  });

  it('names a hook failure and an auth failure', () => {
    expect(pushErrorLine({ message: 'running pre-push hook\nlint failed\nhook declined' })).toBe(
      'running pre-push hook',
    );
    expect(
      pushErrorLine({ message: 'fatal: Authentication failed for https://example.com/acme' }),
    ).toBe('fatal: Authentication failed for https://example.com/acme');
  });

  it('falls back to the first line when nothing names a cause', () => {
    expect(pushErrorLine({ message: 'something odd\nsecond line' })).toBe('something odd');
  });

  it('trims a very long line and reads a huge message', () => {
    const long = pushErrorLine({ message: `denied ${'x'.repeat(100_000)}` });
    expect(long.length).toBe(163);
    expect(long.endsWith('...')).toBe(true);

    const huge = pushErrorLine({ message: `${'noise line\n'.repeat(9000)}permission denied` });
    expect(huge).toBe('noise line');
  });
});
