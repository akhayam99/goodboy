import { NAMES } from '../../../../shared/utils/names';
import type { WaitingRun } from './waitingRunOf';

type Props = {
  readonly run: WaitingRun;
};

export const WaitingRunLine = ({ run }: Props) => (
  <p
    data-slot="card-run"
    className="flex min-w-0 basis-full items-baseline gap-1 text-meta text-muted-foreground"
  >
    <span className="shrink-0">{NAMES.runKind.run}</span>{' '}
    <span className="min-w-0 truncate text-foreground">{run.title}</span>
    {run.more > 0 ? <span className="shrink-0 tabular-nums">{` +${run.more}`}</span> : null}
  </p>
);
