import { IconButton } from '@goodboy/ui';
import { Undo2, Redo2 } from 'lucide-react';

type Props = {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly isBusy: boolean;
  readonly isReadOnly: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
};

export const HistoryActions = ({ canUndo, canRedo, isBusy, isReadOnly, onUndo, onRedo }: Props) => {
  return (
    <div className="flex items-center gap-2">
      {isReadOnly ? null : (
        <>
          <IconButton
            icon={Undo2}
            label="Undo commit edit"
            shortcut="history.undo"
            tooltip={
              isBusy
                ? 'Wait for the edit to finish'
                : canUndo
                  ? 'Undo commit edit'
                  : 'Nothing to undo'
            }
            disabled={isBusy || !canUndo}
            onClick={onUndo}
          />
          <IconButton
            icon={Redo2}
            label="Redo commit edit"
            shortcut="history.redo"
            tooltip={
              isBusy
                ? 'Wait for the edit to finish'
                : canRedo
                  ? 'Redo commit edit'
                  : 'Nothing to redo'
            }
            disabled={isBusy || !canRedo}
            onClick={onRedo}
          />
        </>
      )}
    </div>
  );
};
