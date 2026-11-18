import { CountBadge, StatusDot, cn } from '@goodboy/ui';
import type { ToolCount } from './ToolCount';
import { TOOL_CORNER_SLOT } from './toolCornerSlot';

type Props = {
  readonly count: ToolCount;
};

export const ToolCountMark = ({ count }: Props) => {
  if (count.count > 0) {
    return (
      <CountBadge
        count={count.count}
        tone={count.tone}
        placement="corner"
        isAnnounced={false}
        testId="tool-count"
        className="pointer-events-none"
      />
    );
  }
  if (count.tone === 'neutral') {
    return null;
  }
  return (
    <span
      aria-hidden
      data-testid="tool-warning"
      data-tone={count.tone}
      className={cn(TOOL_CORNER_SLOT.end, 'pointer-events-none')}
    >
      <StatusDot tone={count.tone} size="sm" />
    </span>
  );
};
