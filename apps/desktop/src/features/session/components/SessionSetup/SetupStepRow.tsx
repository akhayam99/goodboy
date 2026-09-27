import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { SetupStepStatus } from './sessionSetupSteps';
import { SetupStepMarker } from './SetupStepMarker';

type Props = {
  readonly ordinal: number;
  readonly status: SetupStepStatus;
  readonly title: string;
  readonly line: string;
  readonly summary: string | null;
  readonly onFocus: () => void;
  readonly children: ReactNode;
};

const ROW =
  'grid w-full min-w-0 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-2 py-1.5 text-left';

const AFFORDANCE: Readonly<Record<SetupStepStatus, string>> = {
  current: '',
  done: 'Edit',
  skipped: 'Add',
  upcoming: 'Start',
};

export const SetupStepRow = ({
  ordinal,
  status,
  title,
  line,
  summary,
  onFocus,
  children,
}: Props) => {
  if (status === 'current') {
    return (
      <li aria-current="step" className="flex flex-col gap-3 rounded-lg bg-subtle px-2 pb-3 pt-1.5">
        <div className={cn(ROW, 'px-0 py-0')}>
          <SetupStepMarker ordinal={ordinal} status={status} />
          <div className="flex min-w-0 flex-col">
            <span className="text-row text-foreground">{title}</span>
            <span className="text-secondary text-muted-foreground">{line}</span>
          </div>
        </div>
        <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3">
          <div className="col-start-2 min-w-0">{children}</div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={onFocus}
        aria-label={summary === null ? title : `${title}: ${summary}`}
        className={cn(
          ROW,
          'group motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        )}
      >
        <SetupStepMarker ordinal={ordinal} status={status} />
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              'shrink-0 text-row',
              status === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {title}
          </span>
          {summary === null ? null : (
            <span className="min-w-0 truncate text-label text-muted-foreground">{summary}</span>
          )}
        </span>
        <span className="text-label text-faint-foreground opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {AFFORDANCE[status]}
        </span>
      </button>
    </li>
  );
};
