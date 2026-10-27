import { describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { aTrackerMove } from '../../../store/slices/tracker-moves/testing/aTrackerMove';
import type { MoveTrackerItemResult } from '../../../store/slices/tracker-moves/types';
import type { AppStore } from '../../../store/store';
import { moveTrackerAction } from './moveTrackerAction';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

const MOVE = aTrackerMove();

type MovedParams = {
  readonly result: MoveTrackerItemResult;
};

const actionAfter = ({ result }: MovedParams) => {
  const moveTrackerItem = vi.fn<AppStore['moveTrackerItem']>(async () => result);
  const undoTrackerMove = vi.fn<AppStore['undoTrackerMove']>(async () => undefined);
  const reportError = vi.fn<AppStore['reportError']>(async () => undefined);
  const showToast = vi.fn();
  const action = moveTrackerAction({
    sessionId: SESSION_ID,
    move: MOVE,
    moveTrackerItem,
    undoTrackerMove,
    reportError,
    showToast,
  });
  return { action, moveTrackerItem, undoTrackerMove, reportError, showToast };
};

describe('moveTrackerAction', () => {
  it('moves the tracker item on one click and offers Undo on the toast', async () => {
    const { action, moveTrackerItem, undoTrackerMove, showToast } = actionAfter({
      result: { kind: 'moved', move: MOVE },
    });

    expect(action.label).toBe('Move to Done');
    expect(action.shortLabel).toBe('Move');
    await action.run();

    expect(moveTrackerItem).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      key: 'linear:issue-412',
    });
    const toast = showToast.mock.calls.at(-1)?.[0];
    expect(toast).toMatchObject({ kind: 'success', message: 'HBL-412 moved to Done' });
    toast.action.onClick();
    expect(undoTrackerMove).toHaveBeenCalledWith({ sessionId: SESSION_ID, move: MOVE });
  });

  it('says nothing when the item was already done or the offer is gone', async () => {
    const { action, showToast } = actionAfter({ result: { kind: 'already-done' } });

    await action.run();

    expect(showToast).not.toHaveBeenCalled();
  });

  it('reports a failed Undo with the item named, and leaves the move alone', async () => {
    const { action, undoTrackerMove, reportError, showToast } = actionAfter({
      result: { kind: 'moved', move: MOVE },
    });
    undoTrackerMove.mockRejectedValueOnce(new Error('Jira has no way back'));
    await action.run();

    showToast.mock.calls.at(-1)?.[0].action.onClick();

    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't move HBL-412 back", sessionId: SESSION_ID }),
      ),
    );
  });

  it('hands a refused move back as a rejection so the row logs it once', async () => {
    const { action, moveTrackerItem } = actionAfter({ result: { kind: 'moved', move: MOVE } });
    moveTrackerItem.mockRejectedValueOnce(new Error('Linear refused the change'));

    await expect(action.run()).rejects.toThrow('Linear refused the change');
  });
});
