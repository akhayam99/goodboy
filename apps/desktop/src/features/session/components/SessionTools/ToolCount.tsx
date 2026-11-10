import { countTextOf } from '../../../../shared/utils/countTextOf';

type Props = {
  readonly count: number;
};

export const ToolCount = ({ count }: Props) => (
  <span
    aria-hidden
    data-testid="tool-count"
    className="pointer-events-none absolute right-0 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-hover px-1 text-chip tabular-nums text-muted-foreground"
  >
    {countTextOf({ count })}
  </span>
);
