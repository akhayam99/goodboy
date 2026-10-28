import { describe, expect, it } from 'vitest';
import { pushFailureDigest } from './pushFailureDigest';
import { pushOutputOf } from './pushOutputOf';

const KNIP_OUTPUT = [
  '$ yarn knip --cache',
  'Unused files (15)',
  'src/legacy/ledgerExport.ts',
  'src/legacy/notifyRelay.ts',
  'Unused exports (2)',
  'formatPayment  src/payments/format.ts:4:14',
  'error Command failed with exit code 1.',
  'husky - pre-push script failed (code 1)',
  'error: failed to push some refs to github.com:acme/payments-api.git',
].join('\n');

describe('pushFailureDigest', () => {
  it('names the hook and the check that failed and keeps the first findings', () => {
    const digest = pushFailureDigest({ output: KNIP_OUTPUT });

    expect(digest.check).toBe('pre-push: yarn knip --cache');
    expect(digest.findings).toEqual([
      'Unused files (15)',
      'src/legacy/ledgerExport.ts',
      'src/legacy/notifyRelay.ts',
      'Unused exports (2)',
      'formatPayment  src/payments/format.ts:4:14',
    ]);
    expect(digest.verdict).toBe(
      'error: failed to push some refs to github.com:acme/payments-api.git',
    );
  });

  it('bounds the findings and clips a long line', () => {
    const output = [
      '$ pnpm lint',
      ...Array.from({ length: 40 }, (_, index) => `finding ${index}`),
      'x'.repeat(400),
    ].join('\n');

    const digest = pushFailureDigest({ output });

    expect(digest.findings).toHaveLength(12);
    expect(digest.findings.every((line) => line.length <= 163)).toBe(true);
  });

  it('has no check for a plain remote rejection', () => {
    const digest = pushFailureDigest({
      output: [
        'To github.com:acme/notify-relay.git',
        ' ! [rejected]        hl/ledger -> hl/ledger (fetch first)',
        "error: failed to push some refs to 'github.com:acme/notify-relay.git'",
        'hint: Updates were rejected because the remote contains work that you do not',
      ].join('\n'),
    });

    expect(digest.check).toBeNull();
    expect(digest.findings).toEqual([]);
    expect(digest.verdict).toContain('[rejected]');
  });
});

describe('pushOutputOf', () => {
  it('joins both streams, drops color codes and keeps the head and the verdict of a long output', () => {
    const long = `${'a'.repeat(5000)}\nerror: failed to push some refs`;

    const output = pushOutputOf({ stdout: '', stderr: long });

    expect(output.length).toBeLessThan(4200);
    expect(output.startsWith('aaaa')).toBe(true);
    expect(output.endsWith('error: failed to push some refs')).toBe(true);
    expect(pushOutputOf({ stdout: '\u001b[31m$ yarn knip\u001b[0m', stderr: 'boom' })).toBe(
      'boom\n$ yarn knip',
    );
  });
});
