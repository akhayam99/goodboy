import { describe, expect, it } from 'vitest';
import { outputHandoffOf } from './outputHandoff';

const base = {
  subject: 'Check posting drift',
  outcome: 'Exit 1',
  projectName: 'ledger-core',
  branch: 'nw/fix-settlement-replay',
} as const;

describe('the handoff title', () => {
  it('names the script, the exit code and the worktree', () => {
    expect(outputHandoffOf({ ...base, output: 'x' }).title).toBe(
      'Output of Check posting drift, Exit 1, ledger-core on nw/fix-settlement-replay',
    );
  });

  it('leaves out what is not known', () => {
    expect(outputHandoffOf({ ...base, outcome: null, branch: null, output: 'x' }).title).toBe(
      'Output of Check posting drift, ledger-core',
    );
    expect(
      outputHandoffOf({ ...base, outcome: '', projectName: null, branch: null, output: 'x' }).title,
    ).toBe('Output of Check posting drift');
  });
});

describe('outputHandoffOf', () => {
  it('writes the title, a blank line and the output', () => {
    const handoff = outputHandoffOf({ ...base, output: 'FAIL postings\nExit 1\n' });
    expect(handoff.text).toBe(
      'Output of Check posting drift, Exit 1, ledger-core on nw/fix-settlement-replay\n\nFAIL postings\nExit 1\n',
    );
    expect(handoff.isTruncated).toBe(false);
    expect(handoff.fileName).toBe(
      'Output of Check posting drift, Exit 1, ledger-core on nw-fix-settlement-replay.txt',
    );
  });

  it('caps the text to its tail and says so with a truncated mark', () => {
    const lines = Array.from({ length: 6_000 }, (_, index) => `line ${index} of the run`);
    const handoff = outputHandoffOf({ ...base, output: lines.join('\n') });
    const body = handoff.text.split('\n\n').slice(1).join('\n\n');
    expect(handoff.isTruncated).toBe(true);
    expect(handoff.text).toContain('[truncated: the last ');
    expect(handoff.text).toContain('line 5999 of the run');
    expect(handoff.text).not.toContain('line 0 of the run');
    expect(body.length).toBeLessThanOrEqual(24_200);
  });

  it('keeps short text whole and drops a line cut in half at the start of a long tail', () => {
    expect(outputHandoffOf({ ...base, output: 'a\nb' }).isTruncated).toBe(false);
    const lines = Array.from({ length: 6_000 }, (_, index) => `line ${index} of the run`);
    const handoff = outputHandoffOf({ ...base, output: lines.join('\n') });
    const firstKept = handoff.text.split('\n\n').slice(1).join('\n\n').split('\n')[1];
    expect(firstKept).toMatch(/^line \d+ of the run$/);
  });

  it('redacts secrets before the text can reach a prompt', () => {
    const handoff = outputHandoffOf({
      ...base,
      output:
        'deploy with token ghp_abcdefghijklmnopqrstuvwxyz0123456789\nAuthorization: Bearer abc.def.ghi',
    });
    expect(handoff.text).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz0123456789');
    expect(handoff.text).not.toContain('abc.def.ghi');
    expect(handoff.text).toContain('[redacted]');
  });

  it('gives each handoff its own id', () => {
    const first = outputHandoffOf({ ...base, output: 'a' });
    const second = outputHandoffOf({ ...base, output: 'a' });
    expect(first.id).not.toBe(second.id);
  });
});
