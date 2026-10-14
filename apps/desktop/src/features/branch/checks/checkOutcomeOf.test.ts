import { describe, expect, it } from 'vitest';
import type { PrCheckConclusion, PrCheckRun } from '@goodboy/types';
import { checkOutcomeOf } from './checkOutcomeOf';

const OLD_URL = 'https://ci.example.test/northwind/runs/101';
const NEW_URL = 'https://ci.example.test/northwind/runs/102';

type RunParams = {
  readonly conclusion: PrCheckConclusion;
  readonly detailsUrl: string;
};

const runOf = ({ conclusion, detailsUrl }: RunParams): PrCheckRun => ({
  name: 'lint',
  conclusion,
  detailsUrl,
  durationMs: null,
});

describe('checkOutcomeOf', () => {
  it('reads the old run still listed as running', () => {
    expect(
      checkOutcomeOf({
        checks: [runOf({ conclusion: 'failure', detailsUrl: OLD_URL })],
        name: 'lint',
        analyzedUrl: OLD_URL,
      }),
    ).toBe('running');
  });

  it('reads a missing check or an unknown name as running', () => {
    expect(checkOutcomeOf({ checks: [], name: 'lint', analyzedUrl: OLD_URL })).toBe('running');
    expect(
      checkOutcomeOf({
        checks: [runOf({ conclusion: 'success', detailsUrl: NEW_URL })],
        name: null,
        analyzedUrl: OLD_URL,
      }),
    ).toBe('running');
  });

  it.each<readonly [PrCheckConclusion, string]>([
    ['success', 'passed'],
    ['failure', 'failed'],
    ['timed_out', 'failed'],
    ['pending', 'running'],
    ['unknown', 'running'],
  ])('reads a new run concluded %s as %s', (conclusion, expected) => {
    expect(
      checkOutcomeOf({
        checks: [runOf({ conclusion, detailsUrl: NEW_URL })],
        name: 'lint',
        analyzedUrl: OLD_URL,
      }),
    ).toBe(expected);
  });
});
