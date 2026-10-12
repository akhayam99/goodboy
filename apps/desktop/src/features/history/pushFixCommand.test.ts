import { describe, expect, it } from 'vitest';
import { pushFixBrief } from './pushFixBrief';
import { pushFixCommand } from './pushFixCommand';

describe('pushFixCommand', () => {
  it('pins the lease to the known online sha', () => {
    expect(pushFixCommand({ branch: 'fix/ledger-postings', remoteSha: 'a1b2c3d' })).toBe(
      "git push --force-with-lease='fix/ledger-postings:a1b2c3d' origin 'fix/ledger-postings'",
    );
  });

  it('pushes plainly when no online copy is known', () => {
    expect(pushFixCommand({ branch: 'fix/ledger-postings', remoteSha: null })).toBe(
      "git push origin 'fix/ledger-postings'",
    );
  });

  it('quotes a branch carrying shell metacharacters', () => {
    expect(pushFixCommand({ branch: 'x;touch pwned', remoteSha: null })).toBe(
      "git push origin 'x;touch pwned'",
    );
    expect(pushFixCommand({ branch: '$(whoami)', remoteSha: 'a1b2c3d' })).toBe(
      "git push --force-with-lease='$(whoami):a1b2c3d' origin '$(whoami)'",
    );
    expect(pushFixCommand({ branch: "it's", remoteSha: null })).toBe("git push origin 'it'\\''s'");
  });
});

describe('pushFixBrief', () => {
  it('carries the command and the git output and forbids pushing', () => {
    const brief = pushFixBrief({
      branch: 'fix/ledger-postings',
      command: 'git push origin fix/ledger-postings',
      output: 'pre-push hook declined',
    });

    expect(brief).toContain('Command: git push origin fix/ledger-postings');
    expect(brief).toContain('pre-push hook declined');
    expect(brief).toContain('Never run git push');
  });
});
