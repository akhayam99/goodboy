import type { WaitingRun } from './waitingRunOf';

type Props = {
  readonly run: WaitingRun;
};

export const WaitingRunLine = ({ run }: Props) => (
  <p data-slot="card-run" className="min-w-0 basis-full truncate text-meta text-muted-foreground">
    Run <span className="text-foreground">{run.title}</span>
    {` · ${run.words}`}
    {run.more > 0 ? <span className="tabular-nums">{` · +${run.more}`}</span> : null}
  </p>
);
