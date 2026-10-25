import { describe, expect, it, vi } from 'vitest';
import { brandId, type PrSeriesId, type SessionId } from '@goodboy/types';
import type { MergeSeriesResult } from '../../../store/slices/pr-series/mergeSeriesInOrder';
import type { AppStore } from '../../../store/store';
import { mergeSeriesAction } from './mergeSeriesAction';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const SERIES_ID = brandId<PrSeriesId>({ value: 'series-ledger-rounding' });

type ResultParams = {
  readonly result: MergeSeriesResult;
};

const actionAfter = ({ result }: ResultParams) => {
  const mergeSeriesInOrder = vi.fn<AppStore['mergeSeriesInOrder']>(async () => result);
  const showToast = vi.fn();
  const action = mergeSeriesAction({
    sessionId: SESSION_ID,
    seriesId: SERIES_ID,
    name: 'ledger-rounding',
    mergeSeriesInOrder,
    showToast,
  });
  return { action, mergeSeriesInOrder, showToast };
};

describe('mergeSeriesAction', () => {
  it('merges the series on one confirmed click and says how many parts went in', async () => {
    const { action, mergeSeriesInOrder, showToast } = actionAfter({
      result: { kind: 'done', merged: 2 },
    });

    expect(action.label).toBe('Merge in order');
    expect(action.requiresConfirm).toBe(true);
    await action.run();

    expect(mergeSeriesInOrder).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      seriesId: SERIES_ID,
    });
    expect(showToast.mock.calls.at(-1)?.[0]).toMatchObject({
      kind: 'success',
      message: 'Merged 2 parts of ledger-rounding in order',
    });
  });

  it('stops at the first part that cannot merge and says why, so the row shows it', async () => {
    const { action, showToast } = actionAfter({
      result: { kind: 'stopped', merged: 1, partLabel: '3', reason: 'part 3 has failing checks' },
    });

    await expect(action.run()).rejects.toThrow('Stopped before part 3: part 3 has failing checks');
    expect(showToast.mock.calls.at(-1)?.[0]).toMatchObject({
      kind: 'warning',
      message: 'Merged 1 part of ledger-rounding in order',
    });
  });

  it('merges nothing and stays quiet when the series is gone', async () => {
    const { action, showToast } = actionAfter({ result: { kind: 'gone' } });

    await action.run();

    expect(showToast).not.toHaveBeenCalled();
  });
});
