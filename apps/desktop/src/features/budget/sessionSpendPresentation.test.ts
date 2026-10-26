import { describe, expect, it } from 'vitest';
import type { SessionBudget, SessionId } from '@goodboy/types';
import { brandedId } from '../history/testing/brandedId';
import { sessionSpendPresentation } from './sessionSpendPresentation';

const SID = brandedId<SessionId>({ value: 'mock-session-harborline-export' });

type LimitParams = {
  readonly softCapUsd: number;
  readonly warnRatio?: number;
  readonly onExceed?: SessionBudget['onExceed'];
};

const limitOf = ({
  softCapUsd,
  warnRatio = 0.8,
  onExceed = 'pause',
}: LimitParams): SessionBudget => ({
  sessionId: SID,
  softCapUsd,
  warnRatio,
  onExceed,
});

describe('sessionSpendPresentation', () => {
  it('reads the spend alone, compact and full, with no limit', () => {
    const shown = sessionSpendPresentation({ totalUsd: 3.47, limit: null });

    expect(shown.label).toBe('$3.47');
    expect(shown.compactLabel).toBe('$3.47');
    expect(shown.sentence).toBe('$3.47 spent in this session');
  });

  it('drops the cents of a whole limit in the compact form and keeps the sentence', () => {
    const shown = sessionSpendPresentation({ totalUsd: 0, limit: limitOf({ softCapUsd: 10 }) });

    expect(shown.compactLabel).toBe('$0 / $10');
    expect(shown.label).toBe('$0 of $10.00');
    expect(shown.sentence).toBe('$0 spent of the $10.00 limit in this session');
    expect(shown.level).toBe('clear');
  });

  it('keeps the cents of a limit that has them', () => {
    const shown = sessionSpendPresentation({
      totalUsd: 2.77,
      limit: limitOf({ softCapUsd: 12.5 }),
    });

    expect(shown.compactLabel).toBe('$2.77 / $12.50');
  });

  it('says paused in the sentence once a pausing limit is passed, not in the compact form', () => {
    const shown = sessionSpendPresentation({ totalUsd: 10.2, limit: limitOf({ softCapUsd: 10 }) });

    expect(shown.isPaused).toBe(true);
    expect(shown.compactLabel).toBe('$10.20 / $10');
    expect(shown.label).toBe('Paused · $10.20 of $10.00');
    expect(shown.sentence).toBe('Paused, $10.20 spent of the $10.00 limit in this session');
    expect(shown.tone).toBe('danger');
  });

  it('warns from 80 percent without pausing a warn only limit', () => {
    const near = sessionSpendPresentation({ totalUsd: 8.4, limit: limitOf({ softCapUsd: 10 }) });
    const over = sessionSpendPresentation({
      totalUsd: 11,
      limit: limitOf({ softCapUsd: 10, onExceed: 'warn' }),
    });

    expect(near.tone).toBe('warning');
    expect(over.isPaused).toBe(false);
    expect(over.sentence).toBe('$11.00 spent of the $10.00 limit in this session');
  });

  it('passes the limit at exactly the cap and warns at exactly eighty percent', () => {
    const atCap = sessionSpendPresentation({ totalUsd: 10, limit: limitOf({ softCapUsd: 10 }) });
    const atNear = sessionSpendPresentation({ totalUsd: 8, limit: limitOf({ softCapUsd: 10 }) });
    const below = sessionSpendPresentation({ totalUsd: 7.99, limit: limitOf({ softCapUsd: 10 }) });

    expect(atCap.level).toBe('over');
    expect(atCap.isPaused).toBe(true);
    expect(atNear.level).toBe('near');
    expect(below.level).toBe('clear');
  });

  it('reads a limit of zero as already passed', () => {
    const shown = sessionSpendPresentation({ totalUsd: 0, limit: limitOf({ softCapUsd: 0 }) });

    expect(shown.ratio).toBe(1);
    expect(shown.level).toBe('over');
    expect(shown.isPaused).toBe(true);
  });

  it('warns at the ratio the backend sent, not at a number of its own', () => {
    const limit = limitOf({ softCapUsd: 10, warnRatio: 0.5 });

    expect(sessionSpendPresentation({ totalUsd: 5, limit }).level).toBe('near');
    expect(sessionSpendPresentation({ totalUsd: 4.99, limit }).level).toBe('clear');
  });
});
