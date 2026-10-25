// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionAttentionReason, SessionStageInfo } from '@goodboy/types';
import { ATTENTION_REASON_META, attentionWordsOf } from '../../../session/session-stage';
import { boardSignalOf } from './boardSignalOf';

const infoOf = (patch: Partial<SessionStageInfo>): SessionStageInfo => ({
  stage: 'running',
  reason: '',
  addsFact: false,
  attention: null,
  prState: null,
  ...patch,
});

const PR = { state: 'open', number: 418 } as const;
const NONE = { state: 'none' } as const;

describe('the one signal of a session card', () => {
  it('ranks an open question, then a failed check, then the pull request, then running work', () => {
    const everything = infoOf({ openQuestionCount: 2, attention: 'ci-failed', isRunning: true });
    expect(
      boardSignalOf({
        info: everything,
        request: PR,
        prFetchState: 'known',
        runningCount: 3,
        isArchived: false,
      }),
    ).toEqual({
      kind: 'attention',
      reason: 'open-question',
      label: '2 questions for you',
      word: '2',
    });
    expect(
      boardSignalOf({
        info: infoOf({ otherReasons: ['ci-failed'], isRunning: true }),
        request: PR,
        prFetchState: 'known',
        runningCount: 3,
        isArchived: false,
      }),
    ).toEqual({ kind: 'attention', reason: 'ci-failed', label: 'Checks failing', word: 'Checks' });
    expect(
      boardSignalOf({
        info: infoOf({ isRunning: true }),
        request: PR,
        prFetchState: 'known',
        runningCount: 3,
        isArchived: false,
      }),
    ).toEqual({ kind: 'request', request: PR });
    expect(
      boardSignalOf({
        info: infoOf({ isRunning: true }),
        request: NONE,
        prFetchState: 'known',
        runningCount: 3,
        isArchived: false,
      }),
    ).toEqual({ kind: 'running', count: 3 });
  });

  it('counts one running when the session runs with no agent turn live yet', () => {
    expect(
      boardSignalOf({
        info: infoOf({ isRunning: true }),
        request: NONE,
        prFetchState: 'known',
        runningCount: 0,
        isArchived: false,
      }),
    ).toEqual({ kind: 'running', count: 1 });
  });

  it('marks the pull request slot while the host has not answered, below running work', () => {
    expect(
      boardSignalOf({
        info: infoOf({}),
        request: NONE,
        prFetchState: 'unknown',
        runningCount: 0,
        isArchived: false,
      }),
    ).toEqual({ kind: 'request-pending', fetchState: 'unknown', host: 'github' });
    expect(
      boardSignalOf({
        info: infoOf({}),
        request: NONE,
        prFetchState: 'unreachable',
        runningCount: 2,
        isArchived: false,
      }),
    ).toEqual({ kind: 'running', count: 2 });
  });

  it('keeps an archived session to its pull request', () => {
    const info = infoOf({ openQuestionCount: 1, attention: 'ci-failed', isRunning: true });
    expect(
      boardSignalOf({
        info,
        request: NONE,
        prFetchState: 'unknown',
        runningCount: 1,
        isArchived: true,
      }),
    ).toEqual({ kind: 'none' });
    expect(
      boardSignalOf({
        info,
        request: PR,
        prFetchState: 'known',
        runningCount: 1,
        isArchived: true,
      }),
    ).toEqual({ kind: 'request', request: PR });
  });
});

const isReason = (value: string): value is SessionAttentionReason =>
  Object.hasOwn(ATTENTION_REASON_META, value);

const REASONS = Object.keys(ATTENTION_REASON_META).filter(isReason);

const OTHER_LANE_REASONS: ReadonlyArray<SessionAttentionReason> = ['open-question', 'ci-failed'];

describe('the signal of a Needs you card is the registry reason', () => {
  it('walks every reason the registry names', () => {
    expect(REASONS.length).toBeGreaterThanOrEqual(17);
  });

  it.each(REASONS)('%s: the card in the Needs you lane says the registry words', (reason) => {
    const info = infoOf({ stage: 'attention', attention: reason });
    const words = attentionWordsOf({ reason, counts: info });

    expect(
      boardSignalOf({
        info,
        request: PR,
        prFetchState: 'known',
        runningCount: 2,
        isArchived: false,
      }),
    ).toEqual({ kind: 'attention', reason, label: words, word: words });
    expect(words).not.toBe('');
  });

  it.each(REASONS)('%s: the same reason in another lane keeps its old signal', (reason) => {
    const info = infoOf({ stage: 'running', attention: null, otherReasons: [reason] });
    const signal = boardSignalOf({
      info,
      request: NONE,
      prFetchState: 'known',
      runningCount: 1,
      isArchived: false,
    });

    if (OTHER_LANE_REASONS.includes(reason)) {
      expect(signal).toMatchObject({ kind: 'attention', reason });
      return;
    }
    expect(signal).toEqual({ kind: 'running', count: 1 });
  });

  it('puts the winner of the stage first, not the open question behind it', () => {
    const info = infoOf({
      stage: 'attention',
      attention: 'needs-approval',
      otherReasons: ['open-question'],
      openQuestionCount: 1,
    });

    expect(
      boardSignalOf({
        info,
        request: NONE,
        prFetchState: 'known',
        runningCount: 0,
        isArchived: false,
      }),
    ).toMatchObject({ kind: 'attention', reason: 'needs-approval' });
  });

  it('counts the questions in the words of the lane card', () => {
    const info = infoOf({ stage: 'attention', attention: 'open-question', openQuestionCount: 3 });

    expect(
      boardSignalOf({
        info,
        request: NONE,
        prFetchState: 'known',
        runningCount: 0,
        isArchived: false,
      }),
    ).toMatchObject({ label: '3 questions for you', word: '3 questions for you' });
  });
});
