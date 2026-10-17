import type { ReactNode } from 'react';
import type { PrCheckRun } from '@goodboy/types';
import { FOCUS_RING, ROW_INTERACTIVE, Tooltip, cn } from '@goodboy/ui';
import { formatDuration } from '../../../../../shared/utils/time/formatDuration';
import { CheckConclusionIcon } from './CheckConclusionIcon';

export type CheckRunRowParts = {
  readonly tooltip: string;
  readonly status?: ReactNode;
  readonly action?: ReactNode;
  readonly hint?: ReactNode;
  readonly onOpen: () => void;
};

type Props = CheckRunRowParts & {
  readonly check: PrCheckRun;
};

type DurationParams = Pick<Props, 'check'>;

const durationOf = ({ check }: DurationParams): string =>
  check.durationMs === null ? '' : (formatDuration({ durationMs: check.durationMs }) ?? '');

export const CheckRunRow = ({ check, tooltip, status, action, hint, onOpen }: Props) => (
  <li data-check-row={check.name} className="col-span-full grid grid-cols-subgrid items-center">
    <Tooltip content={tooltip} anchorClassName="min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'grid w-full min-w-0 grid-cols-[16px_minmax(0,1fr)_56px] items-center gap-2 rounded-md px-2 py-1 text-left text-body transition-colors',
          ROW_INTERACTIVE,
          FOCUS_RING,
        )}
      >
        <CheckConclusionIcon conclusion={check.conclusion} />
        <span className="min-w-0 truncate text-foreground">{check.name}</span>
        <span className="text-right text-label tabular-nums text-faint-foreground">
          {durationOf({ check })}
        </span>
      </button>
    </Tooltip>
    <span data-check-status="" className="flex min-w-0 items-center gap-2">
      {status}
    </span>
    <span data-check-action="" className="flex items-center justify-end">
      {action}
    </span>
    {hint === null || hint === undefined ? null : <div className="col-span-full">{hint}</div>}
  </li>
);
