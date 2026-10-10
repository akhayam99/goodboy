import { describe, expect, it } from 'vitest';
import type { HistoryRunPhase, HistoryStop } from '../../store/slices/history/types';
import { rebaseJobOf } from './rebaseJob';
import { aRebaseRun } from './testing/aRebaseRun';

const job = (patch: Parameters<typeof aRebaseRun>[0], dirtyCount: number | null = 0) =>
  rebaseJobOf({
    run: aRebaseRun(patch),
    projectName: 'payments-api',
    baseBranch: 'main',
    commitCount: patch?.commitCount ?? null,
    dirtyCount,
  });

const stop = (patch: Partial<HistoryStop>): HistoryStop => ({
  reason: 'failed',
  message: '',
  files: [],
  sha: null,
  ...patch,
});

describe('a rebase job while it runs', () => {
  it('checks the branch first', () => {
    expect(job({ phase: 'predicting' })).toMatchObject({
      state: 'checking',
      title: 'Rebasing payments-api on main',
      line: 'Checking the branch',
      isRunning: true,
    });
  });

  it('counts the commits it replays before the engine reports a step', () => {
    expect(job({ phase: 'trying', commitCount: 7 })?.line).toBe('Replaying 7 commits');
    expect(job({ phase: 'trying', commitCount: 1 })?.line).toBe('Replaying 1 commit');
  });

  it('says which step it is on once the engine reports one', () => {
    expect(
      job({ phase: 'trying', progress: { stage: 'step', index: 3, total: 7, sha: 'a1' } })?.line,
    ).toBe('Replaying 3 of 7');
  });

  it('names the file the rewriter merges, with a count for the rest', () => {
    const one = job({
      phase: 'rewriting',
      stop: stop({ reason: 'conflict', files: ['webhook.ts'] }),
    });
    const many = job({
      phase: 'rewriting',
      stop: stop({ reason: 'conflict', files: ['webhook.ts', 'a.ts', 'b.ts'] }),
    });
    const none = job({ phase: 'rewriting', stop: stop({ reason: 'conflict' }) });

    expect(one).toMatchObject({
      state: 'merging',
      line: 'History rewriter is merging webhook.ts in a copy',
    });
    expect(many?.line).toBe('History rewriter is merging webhook.ts and 2 more in a copy');
    expect(none?.line).toBe('History rewriter is merging the conflict in a copy');
  });

  it('checks the result once the rewriter finished', () => {
    expect(job({ phase: 'rewriting', progress: { stage: 'check' } })).toMatchObject({
      state: 'checking-result',
      line: 'Checking the result against your branch',
    });
  });

  it('moves the branch, then updates the online copy', () => {
    expect(job({ phase: 'applying' })?.line).toBe('Moving the branch. A backup is saved first.');
    expect(job({ phase: 'pushing' })?.line).toBe('Updating the online copy with a safe force push');
  });

  it('says who it waits for', () => {
    expect(job({ phase: 'waiting', holder: 'Implementer' })?.line).toBe(
      'Implementer is writing here. The branch moves when it stops.',
    );
  });

  it('prefers moving over a stale check mark of the rewriter', () => {
    expect(job({ phase: 'applying', progress: { stage: 'check' } })?.state).toBe('moving');
  });
});

describe('a rebase job that finished', () => {
  it('counts the commits and the backup', () => {
    expect(job({ phase: 'applied', commitCount: 7 })).toMatchObject({
      state: 'done',
      tone: 'ok',
      title: 'Rebased on main',
      line: '7 commits. Backup kept for 30 days.',
      isSettled: true,
    });
  });

  it('says the uncommitted files were not touched', () => {
    expect(job({ phase: 'pushed', commitCount: 7 }, 11)?.line).toBe(
      '7 commits. Your 11 files were not touched. Backup kept for 30 days.',
    );
    expect(job({ phase: 'pushed', commitCount: 1 }, 1)?.line).toBe(
      '1 commit. Your file was not touched. Backup kept for 30 days.',
    );
  });

  it('leaves the count out when the run never knew it', () => {
    expect(job({ phase: 'applied' })?.line).toBe('Backup kept for 30 days.');
  });
});

describe('a rebase job that stopped', () => {
  const cases: ReadonlyArray<readonly [string, Partial<HistoryStop>, string, string, string]> = [
    [
      'uncommitted files',
      { reason: 'dirty' },
      '11 files have changes that are not committed',
      'Commit or stash them, then check again.',
      'Stopped: uncommitted files',
    ],
    [
      'the rewriter stuck',
      { reason: 'stuck', files: ['webhook.ts'] },
      'History rewriter needs you',
      'It could not merge webhook.ts.',
      'Stopped: needs you',
    ],
    [
      'no provider',
      { reason: 'no-provider' },
      'No provider is connected',
      'History rewriter needs one to merge the conflict.',
      'Stopped: no provider',
    ],
    [
      'a result that differs',
      { reason: 'unverified', message: 'changed ledger.ts' },
      'The result did not match your branch',
      'Nothing was changed. Details has the output.',
      'Stopped: result differs',
    ],
    [
      'an origin that moved',
      { reason: 'origin-moved' },
      'Someone pushed to the online copy',
      'Nothing was pushed.',
      'Stopped: origin moved',
    ],
    [
      'a head that moved',
      { reason: 'head-moved' },
      'The branch moved',
      'Nothing was changed.',
      'Stopped: branch moved',
    ],
    [
      'a pre-push hook',
      { reason: 'push-failed', message: 'pre-push hook declined\nlint failed' },
      'Rebased, but the push failed',
      'A pre-push hook stopped it. Details has the output.',
      'Stopped: hook stopped the push',
    ],
    [
      'a push without a hook',
      { reason: 'push-failed', message: 'remote unreachable' },
      'Rebased, but the push failed',
      'The online copy was not updated. Details has the output.',
      'Stopped: push failed',
    ],
  ];

  it.each(cases)('reads %s', (_name, patch, title, line, word) => {
    const result = job({ phase: 'stopped', stop: stop(patch) }, 11);

    expect(result).toMatchObject({ title, line, word, isSettled: true, isRunning: false });
  });

  it('keeps a long failure to one line and moves the rest to the details', () => {
    const message = `${'x'.repeat(300)}\nsecond line`;
    const result = job({ phase: 'stopped', stop: stop({ reason: 'failed', message }) });

    expect(result?.state).toBe('failed');
    expect(result?.line.length).toBeLessThan(170);
    expect(result?.detail).toBe(message);
  });

  it('does not invent a count when the status is unknown', () => {
    expect(job({ phase: 'stopped', stop: stop({ reason: 'dirty' }) }, null)?.title).toBe(
      'Some files have changes that are not committed',
    );
  });

  it('says 1 file in the singular', () => {
    expect(job({ phase: 'stopped', stop: stop({ reason: 'dirty' }) }, 1)?.title).toBe(
      '1 file has changes that are not committed',
    );
  });
});

describe('a run that is not a rebase job', () => {
  const quietPhases: ReadonlyArray<HistoryRunPhase> = ['restored', 'rewritten'];

  it.each(quietPhases)('has no banner in the %s phase', (phase) => {
    expect(job({ phase })).toBeNull();
  });

  it('has no banner for a rewrite planned by hand', () => {
    expect(job({ origin: 'plan', phase: 'trying' })).toBeNull();
  });
});
