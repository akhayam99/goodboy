import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import type { PullRequestPort } from '@goodboy/core';
import { ROW_INTERACTIVE, StatusDot, cn } from '@goodboy/ui';
import type {
  PrDetail,
  PullRequestHost,
  PullRequestState,
  PullRequestView,
  SessionId,
} from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pullRequestKindOf } from '../../../../shared/pullRequestKind';
import { checksWordOf } from '../../../integrations/github/checksRollup';
import type { PrMergeReadiness } from '../../../review/prMergeReadiness';
import { pullRequestNumberLabel } from '../../pullRequestNumberLabel';
import { queueLineOf } from '../../queueLineOf';
import { BranchStateChip } from '../BranchHeader/BranchStateChip';
import { checksPropertyWord } from './checksPropertyWord';
import { PROPERTY_ROW as ROW } from './propertyRow';
import { PropertyField } from './PropertyField';
import { ResolvesProperty } from './ResolvesProperty';
import { ReviewersProperty, type ReviewerRequest } from './ReviewersProperty';

type Props = {
  readonly sessionId: SessionId;
  readonly host: PullRequestHost;
  readonly pr: PullRequestState;
  readonly detail: PrDetail | null;
  readonly view: PullRequestView | null;
  readonly port: PullRequestPort | null;
  readonly request: ReviewerRequest;
  readonly readiness: PrMergeReadiness;
  readonly canEdit: boolean;
  readonly onOpenChecks: () => void;
  readonly onMutated: () => void;
};

const READINESS_TONE: Readonly<Record<PrMergeReadiness['tone'], string>> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-foreground',
};

export const PullRequestProperties = ({
  sessionId,
  host,
  pr,
  detail,
  view,
  port,
  request,
  readiness,
  canEdit,
  onOpenChecks,
  onMutated,
}: Props) => {
  const matched = detail !== null && detail.prNumber === pr.number ? detail : null;
  const checks = checksPropertyWord({
    read: matched?.checksRead ?? view?.checks.read ?? 'ok',
    runs: matched?.checks ?? view?.checks.runs ?? [],
  });
  const checksWord = checksWordOf({ pr, detail });
  const checksText = checksWord === 'unknown' ? 'Checks unknown' : checks.text;
  const queueLine = queueLineOf({ pr });
  const state = pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft });
  const isReadinessShown = state !== 'merged' && state !== 'closed';

  return (
    <div aria-label="Properties" role="group" className="flex min-w-0 flex-col gap-3">
      <div data-property-group="state" className="flex min-w-0 flex-col">
        <PropertyField label="State">
          <div className={ROW}>
            <BranchStateChip state={state} host={host} />
            <span className="tabular-nums text-muted-foreground">
              {pullRequestNumberLabel({ host, number: pr.number })}
            </span>
          </div>
        </PropertyField>
        <PropertyField label="Base">
          <div className={ROW}>
            <ArrowRight
              size={ICON_SIZE.row}
              aria-hidden
              className="shrink-0 text-faint-foreground"
            />
            <span className="min-w-0 flex-1 truncate text-code text-foreground">
              {pr.baseBranch}
            </span>
          </div>
        </PropertyField>
        <PropertyField label="Checks">
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
        </PropertyField>
        {isReadinessShown ? (
          <PropertyField label="Readiness">
            <p
              data-testid="pr-readiness"
              className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-2 text-label"
            >
              <span className={READINESS_TONE[readiness.tone]}>{readiness.word}</span>
              {readiness.reason === readiness.word ? null : (
                <span className="text-muted-foreground">{readiness.reason}</span>
              )}
              {queueLine === null ? null : (
                <span data-testid="branch-queue-line" className="text-foreground">
                  {queueLine}
                </span>
              )}
            </p>
          </PropertyField>
        ) : null}
      </div>
      <div data-property-group="people" className="flex min-w-0 flex-col">
        {pr.author == null ? null : (
          <PropertyField label="Author">
            <div className={ROW}>
              <span className="min-w-0 flex-1 truncate text-foreground">{pr.author}</span>
            </div>
          </PropertyField>
        )}
        <ReviewersProperty
          sessionId={sessionId}
          prNumber={pr.number}
          detail={detail}
          view={view}
          port={port}
          request={request}
          onMutated={onMutated}
        />
      </div>
      <div data-property-group="links" className="flex min-w-0 flex-col empty:hidden">
        <ResolvesProperty sessionId={sessionId} pr={pr} view={view} canEdit={canEdit} />
      </div>
    </div>
  );
};
