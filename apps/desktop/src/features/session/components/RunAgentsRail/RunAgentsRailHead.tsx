import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly count: number;
};

export const RunAgentsRailHead = ({ count }: Props) => (
  <div data-lead-rail-head="" className="flex min-w-0 items-center gap-2">
    <h2 className="text-row text-foreground">{NAMES.agents}</h2>
    <span className="text-meta tabular-nums text-faint-foreground">{count}</span>
  </div>
);
