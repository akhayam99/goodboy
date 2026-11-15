import { cn } from '@goodboy/ui';
import { countTextOf } from '../../../../shared/utils/countTextOf';
import { TOOL_CORNER_SLOT } from './toolCornerSlot';

type Props = {
  readonly count: number;
};

export const ToolCount = ({ count }: Props) => (
  <span
    aria-hidden
    data-testid="tool-count"
    className={cn(
      TOOL_CORNER_SLOT.end,
      'rounded-full bg-hover px-1 text-chip tabular-nums text-muted-foreground',
    )}
  >
    {countTextOf({ count })}
  </span>
);
