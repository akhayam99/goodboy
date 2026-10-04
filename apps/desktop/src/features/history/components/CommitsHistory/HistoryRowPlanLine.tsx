import { Fragment } from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import type { HistoryRowLinePart } from './historyRowLine';

type Props = {
  readonly parts: ReadonlyArray<HistoryRowLinePart>;
  readonly conflictFiles: ReadonlyArray<string>;
};

export const HistoryRowPlanLine = ({ parts, conflictFiles }: Props) => {
  const firstFile = conflictFiles[0];
  if (parts.length === 0 && firstFile === undefined) {
    return null;
  }
  return (
    <span className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-label text-muted-foreground">
      {parts.map((part, index) => (
        <Fragment key={part.key}>
          {index > 0 ? (
            <span aria-hidden className="shrink-0 text-faint-foreground">
              ·
            </span>
          ) : null}
          <span className="inline-flex min-w-0 shrink items-center gap-2">
            {part.action === null ? null : (
              <span
                aria-hidden
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  HISTORY_ACTION_CLASSES[part.action].solid,
                )}
              />
            )}
            <span className="truncate">{part.text}</span>
          </span>
        </Fragment>
      ))}
      {firstFile === undefined ? null : (
        <>
          {parts.length > 0 ? (
            <span aria-hidden className="shrink-0 text-faint-foreground">
              ·
            </span>
          ) : null}
          <span
            title={`Replaying this step conflicts in ${conflictFiles.join(', ')}`}
            className="inline-flex shrink-0 items-center gap-1 text-warning"
          >
            <TriangleAlert size={ICON_SIZE.row} aria-hidden />
            may conflict in {firstFile}
          </span>
        </>
      )}
    </span>
  );
};
