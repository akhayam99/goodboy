import { Cloud } from 'lucide-react';
import { Chip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly ownCount: number;
  readonly afterCount: number | null;
  readonly behind: number;
  readonly isOnMain: boolean;
  readonly onlineCount: number;
  readonly prNumber: number | null;
  readonly baseBranch: string;
};

export const HistoryFacts = ({
  ownCount,
  afterCount,
  behind,
  isOnMain,
  onlineCount,
  prNumber,
  baseBranch,
}: Props) => (
  <div className="flex flex-wrap items-center gap-2">
    <Chip
      tone="neutral"
      size="sm"
      icon={<span aria-hidden className="size-2 rounded-full bg-muted-foreground" />}
      label={
        <span>
          <span className="text-foreground tabular-nums">{ownCount}</span>{' '}
          {ownCount === 1 ? 'commit' : 'commits'} of your own
          {afterCount !== null && afterCount !== ownCount ? (
            <>
              , <span className="text-foreground tabular-nums">{afterCount}</span> after Apply
            </>
          ) : null}
        </span>
      }
    />
    <Chip
      tone="neutral"
      size="sm"
      icon={<span aria-hidden className="size-2 rounded-full bg-idle" />}
      label={
        behind > 0 && !isOnMain ? (
          <span>
            {baseBranch} moved on by <span className="text-foreground tabular-nums">{behind}</span>{' '}
            since you started
          </span>
        ) : (
          <span>on top of today&apos;s {baseBranch}</span>
        )
      }
    />
    {onlineCount > 0 ? (
      <Chip
        tone="neutral"
        size="sm"
        icon={<Cloud size={ICON_SIZE.row} aria-hidden />}
        label={
          <span>
            <span className="text-foreground tabular-nums">{onlineCount}</span> already online
            {prNumber === null ? '' : `, PR #${prNumber}`}
          </span>
        }
      />
    ) : null}
  </div>
);
