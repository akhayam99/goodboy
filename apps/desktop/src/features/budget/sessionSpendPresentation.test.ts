import { describe, expect, it } from 'vitest';
import type { SessionBudget, SessionId } from '@goodboy/types';
import { brandedId } from '../history/testing/brandedId';
import { sessionSpendPresentation } from './sessionSpendPresentation';

const SID = brandedId<SessionId>({ value: 'mock-session-harborline-export' });

type LimitParams = {
  readonly softCapUsd: number;
  readonly onExceed?: SessionBudget['onExceed'];
};

const limitOf = ({ softCapUsd, onExceed = 'pause' }: LimitParams): SessionBudget => ({
  sessionId: SID,
  softCapUsd,
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
});
