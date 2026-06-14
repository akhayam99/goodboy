import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { PrComment, PrDetail, PullRequestState } from '@goodboy/types';
import { pickSmartTab, TAB_ICON_BTN, TAB_KEYS, TAB_LABEL, type GithubTabKey } from './lib';
import { computeTabStatus } from './status';
import { AnimatedTabBody } from './parts/AnimatedTabBody';
import { DetailSkeleton } from './parts/DetailSkeleton';
import { ErrorRow } from './parts/ErrorRow';
import { StaleCaption } from './parts/StaleCaption';
import { TabBadge } from './parts/TabBadge';
import { CiPane } from './panes/CiPane';
import { CommentsPane } from './panes/CommentsPane';
import { ReviewPane } from './panes/ReviewPane';

export { pickSmartTab } from './lib';
export { computeTabStatus, type TabStatus } from './status';
export { TabBadge } from './parts/TabBadge';
export type { GithubTabKey } from './lib';

type Props = {
  readonly pr: PullRequestState;
  readonly detail: PrDetail | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
  readonly detailFetchedAt: string | null;
  readonly branchLastActivity: string | null;
  readonly onOpenUrl: (url: string) => void;
  readonly onRefresh: () => void;
  readonly onSpawnFromComment?: (comment: PrComment) => void;
  readonly onSpawnFromReviewChanges?: () => void;
};

export const GithubCard = ({
  pr,
  detail,
  detailLoading,
  detailError,
  detailFetchedAt,
  branchLastActivity,
  onOpenUrl,
  onRefresh,
  onSpawnFromComment,
  onSpawnFromReviewChanges,
}: Props) => {
  const smartDefault = useMemo(
    () => pickSmartTab(pr, detail, branchLastActivity),
    [pr, detail, branchLastActivity],
  );
  const [active, setActive] = useState<GithubTabKey>(smartDefault);
  const [userSelectedPr, setUserSelectedPr] = useState<number | null>(null);
  const isUserPick = userSelectedPr === pr.number;

  useEffect(() => {
    if (!isUserPick) {
      setActive(smartDefault);
    }
  }, [smartDefault, isUserPick]);

  const selectTab = (k: GithubTabKey) => {
    setUserSelectedPr(pr.number);
    setActive(k);
  };

  const tabStatus = useMemo(() => computeTabStatus(pr, detail), [pr, detail]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span
          className="inline-flex rounded border border-border-soft bg-subtle"
          role="tablist"
          aria-label="GitHub card view"
        >
          {TAB_KEYS.map((k) => {
            const isActive = k === active;
            const status = tabStatus[k];
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectTab(k)}
                title={status?.label}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 text-2xs transition-colors first:rounded-l last:rounded-r',
                  isActive
                    ? 'bg-background font-semibold text-foreground shadow-sm'
                    : 'text-muted-foreground/70 hover:text-foreground',
                )}
              >
                <span>{TAB_LABEL[k]}</span>
                {status ? <TabBadge status={status} dim={!isActive} /> : null}
              </button>
            );
          })}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <StaleCaption fetchedAt={detailFetchedAt} />
          <button
            type="button"
            onClick={onRefresh}
            disabled={detailLoading}
            title="refresh GitHub data"
            aria-label="refresh GitHub data"
            className={cn(TAB_ICON_BTN, 'disabled:opacity-40')}
          >
            <RefreshCw size={10} className={cn(detailLoading && 'animate-spin')} aria-hidden />
          </button>
        </div>
      </div>

      <AnimatedTabBody activeKey={active}>
        {detailError ? (
          <ErrorRow message={detailError} onRetry={onRefresh} />
        ) : detailLoading && !detail ? (
          <DetailSkeleton />
        ) : active === 'ci' ? (
          <CiPane checks={detail?.checks ?? []} pr={pr} onOpenUrl={onOpenUrl} />
        ) : active === 'comments' ? (
          <CommentsPane
            comments={detail?.comments ?? []}
            pr={pr}
            onOpenUrl={onOpenUrl}
            onSpawnFromComment={onSpawnFromComment}
          />
        ) : (
          <ReviewPane
            reviews={detail?.reviews ?? []}
            requests={detail?.reviewRequests ?? []}
            pr={pr}
            onOpenUrl={onOpenUrl}
            onSpawnFromReviewChanges={onSpawnFromReviewChanges}
          />
        )}
      </AnimatedTabBody>
    </div>
  );
};
