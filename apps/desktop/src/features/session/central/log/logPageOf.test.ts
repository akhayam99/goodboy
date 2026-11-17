import { describe, expect, it } from 'vitest';
import { LOG_PAGE_ROWS, logPageOf } from './logPageOf';

describe('logPageOf', () => {
  it('shows every row of a log shorter than a page', () => {
    expect(logPageOf({ count: 12, limit: LOG_PAGE_ROWS })).toEqual({
      shownCount: 12,
      hiddenCount: 0,
      nextCount: 0,
    });
  });

  it('shows one page of a long log and offers the next page', () => {
    expect(logPageOf({ count: 389, limit: LOG_PAGE_ROWS })).toEqual({
      shownCount: 50,
      hiddenCount: 339,
      nextCount: 50,
    });
  });

  it('offers only the rows left on the last page', () => {
    expect(logPageOf({ count: 389, limit: 350 })).toEqual({
      shownCount: 350,
      hiddenCount: 39,
      nextCount: 39,
    });
  });

  it('never shows a negative count', () => {
    expect(logPageOf({ count: 0, limit: -5 })).toEqual({
      shownCount: 0,
      hiddenCount: 0,
      nextCount: 0,
    });
  });
});
