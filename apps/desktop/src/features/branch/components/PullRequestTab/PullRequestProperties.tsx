import { Check, ChevronRight } from 'lucide-react';
import type { PullRequestPort } from '@goodboy/core';
import { Button, ROW_INTERACTIVE, StatusDot, cn } from '@goodboy/ui';
import type { PrDetail, PullRequestState, PullRequestView, SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { checksWordOf } from '../../../integrations/github/checksRollup';
import { checksPropertyWord } from './checksPropertyWord';
import { PROPERTY_ROW as ROW } from './propertyRow';
import { PropertyBlock } from './PropertyBlock';
import { ResolvesProperty } from './ResolvesProperty';
import { ReviewersProperty, type ReviewerRequest } from './ReviewersProperty';

type Props = {
  readonly sessionId: SessionId;
  readonly pr: PullRequestState;
  readonly detail: PrDetail | null;
  readonly view: PullRequestView | null;
  readonly port: PullRequestPort | null;
  readonly request: ReviewerRequest;
  readonly canEdit: boolean;
  readonly behind: number | null;
  readonly distanceBase?: string | null;
  readonly onRebase: (() => void) | null;
  readonly onOpenChecks: () => void;
  readonly onMutated: () => void;
};

export const PullRequestProperties = ({
  sessionId,
  pr,
  detail,
  view,
  port,
  request,
  canEdit,
  behind,
  distanceBase = null,
  onRebase,
  onOpenChecks,
  onMutated,
}: Props) => {
  const isOtherBase = distanceBase !== null && distanceBase !== pr.baseBranch;
  const matched = detail !== null && detail.prNumber === pr.number ? detail : null;
  const checks = checksPropertyWord({
    read: matched?.checksRead ?? view?.checks.read ?? 'ok',
    runs: matched?.checks ?? view?.checks.runs ?? [],
  });
  const checksWord = checksWordOf({ pr, detail });
  const checksText = checksWord === 'unknown' ? 'Checks unknown' : checks.text;

  return (
    <aside aria-label="Properties" className="flex min-w-0 flex-col gap-6">
      <ReviewersProperty
        sessionId={sessionId}
        prNumber={pr.number}
        detail={detail}
        view={view}
        port={port}
        request={request}
        onMutated={onMutated}
      />

      <PropertyBlock label="Checks">
        <button
          type="button"
          onClick={onOpenChecks}
          className={cn(ROW, 'w-full rounded-md px-1 text-left', ROW_INTERACTIVE)}
        >
          {checks.tone === 'success' && (
            <Check size={ICON_SIZE.control} aria-hidden className="shrink-0 text-success" />
          )}
          {checks.tone === 'danger' && <StatusDot tone="danger" size="sm" />}
          {checks.tone === 'info' && <StatusDot tone="info" size="sm" pulsing />}
          <span className="min-w-0 flex-1 truncate text-foreground">{checksText}</span>
          <ChevronRight
            size={ICON_SIZE.row}
            aria-hidden
            className="shrink-0 text-faint-foreground"
          />
        </button>
      </PropertyBlock>

      <ResolvesProperty sessionId={sessionId} pr={pr} view={view} canEdit={canEdit} />

      <PropertyBlock label="Base">
        <div className={ROW}>
          <span className="min-w-0 flex-1 truncate text-code text-foreground">{pr.baseBranch}</span>
        </div>
        {isOtherBase ? null : (
          <div className="flex min-h-6 min-w-0 flex-wrap items-center gap-x-2 text-meta text-muted-foreground">
            <span>
              {behind === null || behind === 0
                ? `Up to date with ${pr.baseBranch}`
                : `${behind} behind ${pr.baseBranch}`}
            </span>
            {behind !== null && behind > 0 && onRebase !== null && (
              <Button size="xs" variant="ghost" onClick={onRebase}>
                Rebase on {pr.baseBranch}
              </Button>
            )}
          </div>
        )}
      </PropertyBlock>
    </aside>
  );
};
