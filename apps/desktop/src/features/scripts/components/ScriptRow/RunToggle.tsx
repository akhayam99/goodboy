import { Play, Square } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SCRIPT_ROW_CELL } from './scriptRowCells';

type Props = {
  readonly name: string;
  readonly isRunning: boolean;
  readonly blockedReason: string | null;
  readonly onRun: () => void;
  readonly onStop: () => void;
};

export const RunToggle = ({ name, isRunning, blockedReason, onRun, onStop }: Props) => (
  <span className={SCRIPT_ROW_CELL.action}>
    {isRunning ? (
      <IconButton
        size="xs"
        variant="ghost"
        icon={Square}
        iconSize={ICON_SIZE.row}
        label={`Stop ${name}`}
        onClick={onStop}
      />
    ) : (
      <IconButton
        size="xs"
        variant="ghost"
        icon={Play}
        iconSize={ICON_SIZE.row}
        label={`Run ${name}`}
        tooltip={blockedReason ?? undefined}
        disabled={blockedReason !== null}
        onClick={onRun}
      />
    )}
  </span>
);
