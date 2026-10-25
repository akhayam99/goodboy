import type { SessionId } from '@goodboy/types';
import type { ShowToast } from '../../../shared/components/Toast';
import type { AppStore } from '../../../store/store';
import type { TrackerMove } from '../../../store/slices/tracker-moves/types';

type Params = {
  readonly sessionId: SessionId;
  readonly move: TrackerMove;
  readonly moveTrackerItem: AppStore['moveTrackerItem'];
  readonly undoTrackerMove: AppStore['undoTrackerMove'];
  readonly reportError: AppStore['reportError'];
  readonly showToast: ShowToast;
};

export const moveTrackerAction = ({
  sessionId,
  move,
  moveTrackerItem,
  undoTrackerMove,
  reportError,
  showToast,
}: Params) => ({
  label: `Move to ${move.toName}`,
  shortLabel: 'Move',
  isDisabled: false,
  failureTitle: `Couldn't move ${move.identifier}`,
  run: async () => {
    const result = await moveTrackerItem({ sessionId, key: move.key });
    if (result.kind !== 'moved') {
      return;
    }
    showToast({
      kind: 'success',
      message: `${move.identifier} moved to ${move.toName}`,
      action: {
        label: 'Undo',
        onClick: () => {
          undoTrackerMove({ sessionId, move: result.move }).catch((error: unknown) =>
            reportError({
              title: `Couldn't move ${move.identifier} back`,
              error,
              sessionId,
            }),
          );
        },
      },
    });
  },
});
