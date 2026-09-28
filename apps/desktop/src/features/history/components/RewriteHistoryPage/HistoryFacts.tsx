import { Cloud } from 'lucide-react';
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

const FACT =
  'inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-0.5 text-label text-muted-foreground';

export const HistoryFacts = ({
  ownCount,
  afterCount,
  behind,
  isOnMain,
  onlineCount,
  prNumber,
  baseBranch,
}: Props) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className={FACT}>
      <span aria-hidden className="size-2 rounded-full bg-muted-foreground" />
      <span>
        <span className="text-foreground tabular-nums">{ownCount}</span>{' '}
        {ownCount === 1 ? 'commit' : 'commits'} of your own
        {afterCount !== null && afterCount !== ownCount ? (
          <>
            , <span className="text-foreground tabular-nums">{afterCount}</span> after Apply
          </>
        ) : null}
      </span>
    </span>
    <span className={FACT}>
      <span aria-hidden className="size-2 rounded-full bg-idle" />
      {behind > 0 && !isOnMain ? (
        <span>
          {baseBranch} moved on by <span className="text-foreground tabular-nums">{behind}</span>{' '}
          since you started
        </span>
      ) : (
        <span>on top of today&apos;s {baseBranch}</span>
      )}
    </span>
    {onlineCount > 0 ? (
      <span className={FACT}>
        <Cloud size={ICON_SIZE.row} aria-hidden />
        <span>
          <span className="text-foreground tabular-nums">{onlineCount}</span> already online
          {prNumber === null ? '' : `, PR #${prNumber}`}
        </span>
      </span>
    ) : null}
  </div>
);
