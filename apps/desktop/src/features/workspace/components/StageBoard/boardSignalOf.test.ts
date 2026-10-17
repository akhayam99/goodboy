// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionStageInfo } from '@goodboy/types';
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
    ).toEqual({ kind: 'question', count: 2 });
    expect(
      boardSignalOf({
        info: infoOf({ otherReasons: ['ci-failed'], isRunning: true }),
        request: PR,
        prFetchState: 'known',
        runningCount: 3,
        isArchived: false,
      }),
    ).toEqual({ kind: 'checks-failed' });
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
    ).toEqual({ kind: 'request-pending', fetchState: 'unknown' });
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
