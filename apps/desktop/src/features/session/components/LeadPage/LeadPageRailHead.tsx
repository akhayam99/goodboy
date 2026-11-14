import { PANE_RHYTHM, cn } from '@goodboy/ui';

type Props = {
  readonly count: number;
};

export const LeadPageRailHead = ({ count }: Props) => (
  <div
    data-grid-row="1"
    data-lead-rail-head=""
    className={cn('flex shrink-0 items-center gap-2 px-5', PANE_RHYTHM.firstRow)}
  >
    <h2 className="text-row text-foreground">Agents</h2>
    <span className="text-meta tabular-nums text-faint-foreground">{count}</span>
  </div>
);
