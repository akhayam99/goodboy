import { describe, expect, it, vi } from 'vitest';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import { fetchFailedCheckLog } from './fetchFailedCheckLog';

const projectId = aProject().id;
const workspaceId = aWorkspace().id;
const check = {
  name: 'payments-api / test',
  conclusion: 'failure' as const,
  detailsUrl: 'https://github.com/harborline/payments-api/actions/runs/31/job/42',
  durationMs: null,
};
const target = { cwd: '/mock/payments-api', workspaceId, projectId };

describe('failed Actions logs', () => {
  it('runs exactly the failed job command with the captured target', async () => {
    const run = vi.fn(async () => ({ stdout: 'Assertion failed', stderr: '', exitCode: 0 }));
    expect(await fetchFailedCheckLog({ check, ...target, runner: { run } })).toBe(
      'Assertion failed',
    );
    expect(run).toHaveBeenCalledExactlyOnceWith(
      ['run', 'view', '31', '--job', '42', '--log-failed'],
      target,
    );
  });
  it.each([
    null,
    '',
    ' ',
    'https://gitlab.com/harborline/payments-api/-/jobs/42',
    'https://bitbucket.org/harborline/payments-api/pipelines/42',
    'https://github.com/harborline/payments-api/actions/runs/31',
    'https://github.com/harborline/payments-api/actions/runs/31/job/42?x=1',
    'https://github.com/harborline/payments-api/actions/runs/-1/job/42',
    'x'.repeat(100_000),
  ])('does not invoke a host for %s', async (detailsUrl) => {
    const run = vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 }));
    expect(
      await fetchFailedCheckLog({ check: { ...check, detailsUrl }, ...target, runner: { run } }),
    ).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });
  it.each([true, false])('returns null on a failed command: $0', async (hasThrown) => {
    const run = vi.fn(async () => {
      if (hasThrown) {
        throw new Error('denied');
      }
      return { stdout: '', stderr: 'denied', exitCode: 1 };
    });
    expect(await fetchFailedCheckLog({ check, ...target, runner: { run } })).toBeNull();
  });
});
