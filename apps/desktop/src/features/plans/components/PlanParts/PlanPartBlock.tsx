import type { ReactNode } from 'react';
import { TruncatedText } from '@goodboy/ui';
import type { PlanPartRow } from './planPartRows';

type Props = {
  readonly row: PlanPartRow;
  readonly children: ReactNode;
};

const SHOWN_PATHS = 3;

export const PlanPartBlock = ({ row, children }: Props) => {
  const shown = row.touches.slice(0, SHOWN_PATHS);
  const hidden = row.touches.length - shown.length;
  return (
    <div
      data-testid="plan-part-block"
      data-plan-part-block={String(row.index + 1)}
      className="flex min-w-0 flex-col gap-1 rounded-md border border-border-soft"
    >
      {children}
      {shown.length === 0 ? (
        <p className="px-3 pb-2 text-meta text-faint-foreground">Touches every file</p>
      ) : (
        <ul
          aria-label={`Part ${row.index + 1} touches`}
          className="flex min-w-0 flex-col gap-0.5 px-3 pb-2"
        >
          {shown.map((path) => (
            <TruncatedText as="li" key={path} className="truncate text-code text-muted-foreground">
              {path}
            </TruncatedText>
          ))}
          {hidden > 0 ? (
            <li className="text-meta text-faint-foreground">{`+${hidden} more`}</li>
          ) : null}
        </ul>
      )}
    </div>
  );
};
