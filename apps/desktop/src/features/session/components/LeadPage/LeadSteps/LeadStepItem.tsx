import { cn } from '@goodboy/ui';
import { LeadStepChange } from './LeadStepChange';
import { LeadStepMark } from './LeadStepMark';
import type { StepLine } from './stepLinesOf';

type Props = {
  readonly line: StepLine;
};

const NAME_TONE = {
  done: 'text-foreground',
  running: 'text-foreground',
  attention: 'text-foreground',
  skipped: 'text-faint-foreground',
  queued: 'text-muted-foreground',
  added: 'text-foreground',
} as const satisfies Readonly<Record<StepLine['state'], string>>;

export const LeadStepItem = ({ line }: Props) => (
  <li data-step-state={line.state} className="flex min-w-0 items-start gap-2">
    <span className="flex h-5 shrink-0 items-center">
      <LeadStepMark state={line.state} />
    </span>
    <span className="flex min-w-0 flex-col">
      <span className="flex min-w-0 items-baseline gap-1">
        <span className="shrink-0 text-chip tabular-nums text-faint-foreground">
          {line.ordinal}
        </span>
        <span className={cn('text-meta', NAME_TONE[line.state])}>{line.name}</span>
      </span>
      {line.change !== null && line.reason !== null ? (
        <LeadStepChange word={line.change === 'added' ? 'Added' : 'Moved'} reason={line.reason} />
      ) : null}
      {line.note === null ? null : (
        <span className="max-w-36 text-meta text-faint-foreground">{line.note}</span>
      )}
    </span>
  </li>
);
