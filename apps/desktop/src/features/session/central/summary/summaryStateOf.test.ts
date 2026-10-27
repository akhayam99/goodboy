// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { summaryStateOf } from './summaryStateOf';

const NOW = Date.parse('2026-10-18T10:31:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const SUMMARY_STALE_AFTER_MS = 24 * HOUR_MS;
const SUMMARY_BRANCH_GRACE_MS = 5 * 60 * 1000;

const SUMMARY = [
  '## State',
  '- Limits are enforced on payout creation. The retry fix waits on a review.',
  '- Tests pass in payments-api.',
  '',
  '## Next',
  '- Review the retry fix.',
].join('\n');

type Over = {
  readonly text?: string;
  readonly updatedAtMs?: number | null;
  readonly branchChangedAtMs?: number | null;
};

const stateOf = ({
  text = SUMMARY,
  updatedAtMs = NOW - HOUR_MS,
  branchChangedAtMs = null,
}: Over = {}) => summaryStateOf({ text, updatedAtMs, nowMs: NOW, branchChangedAtMs });

describe('summaryStateOf', () => {
  it('reads the first sentence of the State section, without the list marker', () => {
    expect(stateOf()).toEqual({
      sentence: 'Limits are enforced on payout creation',
      label: 'Written 1h ago',
      isStale: false,
      why: null,
    });
  });

  it('says nothing without a State section or without a sentence in it', () => {
    expect(stateOf({ text: '## Next\n- Review the retry fix.' })).toBeNull();
    expect(stateOf({ text: '## State\n\n## Next\n- Review.' })).toBeNull();
    expect(stateOf({ text: '' })).toBeNull();
  });

  it('greys the sentence once the summary is older than a day', () => {
    expect(stateOf({ updatedAtMs: NOW - SUMMARY_STALE_AFTER_MS - 1 })).toMatchObject({
      isStale: true,
      why: 'old',
      label: 'Written 1d ago, may be out of date',
    });
    expect(stateOf({ updatedAtMs: NOW - SUMMARY_STALE_AFTER_MS })?.isStale).toBe(false);
  });

  it('lets the branch story win when a pull request changed after the summary', () => {
    const updatedAtMs = NOW - 2 * HOUR_MS;

    expect(stateOf({ updatedAtMs, branchChangedAtMs: NOW - HOUR_MS })).toMatchObject({
      isStale: true,
      why: 'branches',
      label: 'Written 2h ago, a branch is newer',
    });
    expect(
      stateOf({ updatedAtMs, branchChangedAtMs: updatedAtMs + SUMMARY_BRANCH_GRACE_MS })?.isStale,
    ).toBe(false);
  });

  it('prefers the branches over age when both hold', () => {
    expect(
      stateOf({ updatedAtMs: NOW - 3 * SUMMARY_STALE_AFTER_MS, branchChangedAtMs: NOW })?.why,
    ).toBe('branches');
  });

  it('keeps the sentence and drops the age while the age is unknown', () => {
    expect(stateOf({ updatedAtMs: null })).toMatchObject({
      sentence: 'Limits are enforced on payout creation',
      label: '',
      isStale: false,
    });
  });
});
