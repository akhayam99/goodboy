import { cn } from '../cn';
import { COUNT_BADGE_CORNER } from '../countBadgeCorner';
import { countTextOf } from '../countTextOf';
import { tintClasses } from '../tint';

export type CountBadgeTone = 'neutral' | 'warning' | 'danger';

type Props = {
  readonly count: number;
  readonly tone?: CountBadgeTone;
  readonly placement?: 'inline' | 'corner';
  readonly label?: string;
  readonly isAnnounced?: boolean;
  readonly testId?: string;
  readonly className?: string;
};

type ToneParams = {
  readonly tone: CountBadgeTone;
};

const toneClassOf = ({ tone }: ToneParams): string =>
  tone === 'neutral' ? 'bg-selected text-muted-foreground' : tintClasses(tone).solid;

export const CountBadge = ({
  count,
  tone = 'neutral',
  placement = 'inline',
  label,
  isAnnounced = true,
  testId,
  className,
}: Props) => {
  if (count <= 0) {
    return null;
  }
  return (
    <span
      {...(isAnnounced
        ? { role: 'img', 'aria-label': label ?? `${count} open` }
        : { 'aria-hidden': true })}
      data-count-badge={tone}
      data-placement={placement}
      data-testid={testId}
      className={cn(
        'inline-flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full px-0.5 text-chip tabular-nums',
        toneClassOf({ tone }),
        placement === 'corner' && COUNT_BADGE_CORNER.end,
        className,
      )}
    >
      {countTextOf({ count })}
    </span>
  );
};
