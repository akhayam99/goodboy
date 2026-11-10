import { countTextOf } from '../../../../shared/utils/countTextOf';

type Props = {
  readonly count: number;
};

export const ToolCount = ({ count }: Props) => (
  <span
    aria-hidden
    data-testid="tool-count"
    className="pointer-events-none absolute right-0.5 top-0.5 flex text-rail tabular-nums text-faint-foreground"
  >
    {countTextOf({ count })}
  </span>
);
