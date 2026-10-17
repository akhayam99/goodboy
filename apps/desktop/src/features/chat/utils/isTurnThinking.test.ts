import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { isTurnThinking } from './isTurnThinking';
import type { TranscriptItem } from './transcript-items';

const AT = brandId<IsoDateTime>({ value: '2026-10-16T09:00:00.000Z' });

const USER: TranscriptItem = {
  kind: 'user_text',
  key: 'u1',
  text: 'Continue from where you stopped.',
  at: AT,
};

const ERROR: TranscriptItem = {
  kind: 'error',
  key: 'e1',
  message: 'provider exited without a response',
};

describe('isTurnThinking', () => {
  it('thinks while a running turn has the user message last', () => {
    expect(
      isTurnThinking({ isTurnRunning: true, lastItem: USER, isLastClusterRunning: false }),
    ).toBe(true);
  });

  it('never thinks after an error the turn left without a done', () => {
    expect(
      isTurnThinking({ isTurnRunning: true, lastItem: ERROR, isLastClusterRunning: false }),
    ).toBe(false);
  });

  it('leaves the tail to a running tool cluster', () => {
    expect(
      isTurnThinking({ isTurnRunning: true, lastItem: USER, isLastClusterRunning: true }),
    ).toBe(false);
  });

  it('never thinks when no turn runs', () => {
    expect(
      isTurnThinking({ isTurnRunning: false, lastItem: undefined, isLastClusterRunning: false }),
    ).toBe(false);
  });
});
