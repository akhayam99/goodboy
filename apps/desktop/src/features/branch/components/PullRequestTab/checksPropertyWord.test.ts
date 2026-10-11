// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PrCheckRun } from '@goodboy/types';
import { checksPropertyWord } from './checksPropertyWord';

const run = (conclusion: PrCheckRun['conclusion'], name = 'unit'): PrCheckRun => ({
  name,
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

describe('checksPropertyWord', () => {
  it('says the checks are unknown when the read did not work', () => {
    expect(checksPropertyWord({ read: 'denied', runs: [run('success')] })).toEqual({
      text: 'Checks unknown',
      tone: 'neutral',
    });
    expect(checksPropertyWord({ read: 'unsupported', runs: [] }).text).toBe('Checks unknown');
  });

  it('says nothing ran when the repository has no checks', () => {
    expect(checksPropertyWord({ read: 'ok', runs: [] }).text).toBe('No checks');
  });

  it('counts the passed ones first and the failing ones after, on one line', () => {
    expect(
      checksPropertyWord({
        read: 'ok',
        runs: [run('failure'), run('success'), run('success'), run('success'), run('success')],
      }),
    ).toEqual({ text: '4 passed · 1 failing', tone: 'danger' });
  });

  it('drops the passed count when nothing passed', () => {
    expect(checksPropertyWord({ read: 'ok', runs: [run('failure'), run('failure')] })).toEqual({
      text: '2 failing',
      tone: 'danger',
    });
  });

  it('counts the passed ones first when the rest are still running', () => {
    expect(checksPropertyWord({ read: 'ok', runs: [run('success'), run('pending')] })).toEqual({
      text: '1 passed · 1 running',
      tone: 'info',
    });
  });

  it('says all passed when nothing else is left', () => {
    expect(checksPropertyWord({ read: 'ok', runs: [run('success'), run('skipped')] })).toEqual({
      text: 'All 2 passed',
      tone: 'success',
    });
  });
});
