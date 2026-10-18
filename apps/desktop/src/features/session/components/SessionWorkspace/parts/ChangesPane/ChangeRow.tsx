import { SelectableRow, cn, tintClasses } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ChangeFile } from '../../../../../file-versions/changeTurnsOf';
import { CHANGE_KINDS } from './changeKinds';
import { useChangeSides } from '../../../../../file-versions/useChangeSides';

type Props = {
  readonly sessionId: SessionId;
  readonly file: ChangeFile;
  readonly turnNumber: number;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
};

const COUNT_CLASS = 'shrink-0 text-meta tabular-nums';

export const ChangeRow = ({ sessionId, file, turnNumber, isSelected, onSelect }: Props) => {
  const { sides } = useChangeSides({ sessionId, file });
  const kind = CHANGE_KINDS[file.change];
  const tone = tintClasses(kind.tone);
  const isRestored = file.restoreRunId !== null;
  const counts = sides.status === 'text' ? sides.changes : null;

  return (
    <li>
      <SelectableRow
        selected={isSelected}
        ariaCurrent={isSelected ? 'true' : undefined}
        ariaLabel={`${file.label}, turn ${turnNumber}`}
        onClick={onSelect}
        className="h-8 items-center gap-2 px-2 text-ui text-foreground"
      >
        <span
          aria-hidden
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded-sm text-chip',
            tone.bg,
            tone.text,
          )}
        >
          {kind.letter}
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            file.change === 'deleted' && !isRestored && 'text-muted-foreground line-through',
          )}
        >
          {file.label}
        </span>
        {isRestored ? (
          <span className={cn(COUNT_CLASS, 'text-success')}>
            {file.change === 'added' ? 'Removed' : 'Restored'}
          </span>
        ) : null}
        {!isRestored && file.change === 'added' ? (
          <span className={cn(COUNT_CLASS, 'text-faint-foreground')}>new</span>
        ) : null}
        {!isRestored && file.change !== 'added' && counts !== null ? (
          <span className={cn(COUNT_CLASS, 'flex gap-2')}>
            {counts.additions === 0 ? null : (
              <span className="text-success">+{counts.additions}</span>
            )}
            {counts.deletions === 0 ? null : (
              <span className="text-danger">-{counts.deletions}</span>
            )}
          </span>
        ) : null}
      </SelectableRow>
    </li>
  );
};
