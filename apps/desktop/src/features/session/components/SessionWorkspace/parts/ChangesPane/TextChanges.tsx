import { Fragment, useState } from 'react';
import { FOCUS_RING, cn } from '@goodboy/ui';
import type { TextChanges as TextChangesModel } from '../../../../../file-versions/textChangesOf';
import { ChangeLine } from './ChangeLine';
import { CHANGE_ROW_GRID } from './changeRowGrid';

type Props = {
  readonly changes: TextChangesModel;
  readonly isCode: boolean;
};

export const TextChanges = ({ changes, isCode }: Props) => {
  const [openGaps, setOpenGaps] = useState<ReadonlySet<string>>(new Set());

  return (
    <div role="table" aria-label="Line changes" className="flex flex-col py-2">
      {changes.rows.map((row, index) => {
        if (row.kind === 'line') {
          return <ChangeLine key={`line-${index}`} line={row.line} isCode={isCode} />;
        }
        if (row.kind === 'more') {
          return (
            <div
              key="more"
              role="row"
              className={cn(CHANGE_ROW_GRID, 'bg-subtle py-2 text-meta text-muted-foreground')}
            >
              <span role="cell" />
              <span role="cell" />
              <span role="cell">
                {row.count} more {row.count === 1 ? 'line' : 'lines'} not shown
              </span>
            </div>
          );
        }
        if (openGaps.has(row.id)) {
          return (
            <Fragment key={row.id}>
              {row.lines.map((line) => (
                <ChangeLine key={`${row.id}-${line.lineNumber}`} line={line} isCode={isCode} />
              ))}
            </Fragment>
          );
        }
        return (
          <div key={row.id} role="row" className={cn(CHANGE_ROW_GRID, 'bg-subtle')}>
            <span role="cell" />
            <span role="cell" />
            <span role="cell" className="flex">
              <button
                type="button"
                onClick={() => setOpenGaps((current) => new Set([...current, row.id]))}
                className={cn(
                  FOCUS_RING,
                  'rounded-sm py-2 text-left text-meta text-muted-foreground transition-colors hover:text-foreground',
                )}
              >
                {row.lines.length} unchanged {row.lines.length === 1 ? 'line' : 'lines'}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
};
