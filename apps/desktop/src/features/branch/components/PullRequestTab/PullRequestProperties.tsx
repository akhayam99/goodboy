import { Check, ChevronRight } from 'lucide-react';
import type { PullRequestPort, ReviewSourceKind } from '@goodboy/core';
import { Button, CopyButton, ROW_INTERACTIVE, StatusDot, cn } from '@goodboy/ui';
import type {
  PrDetail,
  PullRequestFileStat,
  PullRequestState,
  PullRequestView,
  SessionId,
} from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { mergeabilityNoteOf, type PrMergeReadiness } from '../../../review/prMergeReadiness';
import { checksWordOf } from '../../../integrations/github/checksRollup';
import { pullRequestWord } from '../../pullRequestWord';
import { checksPropertyWord } from './checksPropertyWord';
import { FileStatRow } from './FileStatRow';
import { PROPERTY_ROW as ROW } from './propertyRow';
import { PropertyBlock } from './PropertyBlock';
import { ResolvesProperty } from './ResolvesProperty';
import { ReviewersProperty, type ReviewerRequest } from './ReviewersProperty';

type Props = {
  readonly sessionId: SessionId;
  readonly host: ReviewSourceKind;
  readonly pr: PullRequestState;
  readonly detail: PrDetail | null;
  readonly view: PullRequestView | null;
  readonly readiness: PrMergeReadiness;
  readonly port: PullRequestPort | null;
  readonly request: ReviewerRequest;
  readonly canEdit: boolean;
  readonly behind: number | null;
  readonly distanceBase?: string | null;
  readonly onRebase: (() => void) | null;
  readonly onOpenChecks: () => void;
  readonly onOpenFiles: (path: string | null) => void;
  readonly onMutated: () => void;
};

export const PullRequestProperties = ({
  sessionId,
  host,
  pr,
  detail,
  view,
  readiness,
  port,
  request,
  canEdit,
  behind,
  distanceBase = null,
  onRebase,
  onOpenChecks,
  onOpenFiles,
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
  const mergeNote =
    pr.state === 'open' ? mergeabilityNoteOf({ host, mergeable: pr.mergeable }) : null;
  const files = view?.files ?? null;
  const stats = files?.first ?? [];

  return (
    <aside
      aria-label="Properties"
      className="order-first grid min-w-0 grid-cols-2 gap-x-6 gap-y-4 @[928px]:order-last @[928px]:flex @[928px]:flex-col @[928px]:gap-6"
    >
      <PropertyBlock label="Status">
        <div className={ROW}>
          {pr.state === 'merged' ? (
            <CONCEPT_ICONS.merge size={ICON_SIZE.control} aria-hidden className="text-merged" />
          ) : (
            <CONCEPT_ICONS.pr
              size={ICON_SIZE.control}
              aria-hidden
              className="text-faint-foreground"
            />
          )}
          <span className="text-foreground">
            {pullRequestWord({ state: pr.state, isDraft: pr.isDraft })}
          </span>
        </div>
        <div className="flex min-h-6 min-w-0 items-center gap-2 text-meta text-muted-foreground">
          {readiness.tone === 'success' ? (
            <Check size={ICON_SIZE.row} aria-hidden className="shrink-0 text-success" />
          ) : readiness.tone === 'neutral' ? null : (
            <StatusDot tone={readiness.tone} size="sm" />
          )}
          <span className="min-w-0">{readiness.word}</span>
        </div>
        {mergeNote !== null && (
          <div className="flex min-h-6 min-w-0 items-center text-meta text-faint-foreground">
            {mergeNote}
          </div>
        )}
      </PropertyBlock>

      <ResolvesProperty sessionId={sessionId} pr={pr} view={view} canEdit={canEdit} />

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

      <PropertyBlock label="Branch">
        <div className={ROW}>
          <span className="min-w-0 flex-1 truncate text-code text-foreground">{pr.headBranch}</span>
          <CopyButton
            value={pr.headBranch}
            label="Copy branch name"
            presentation="icon"
            tone="faint"
          />
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

      <PropertyBlock label="Files changed">
        <button
          type="button"
          onClick={() => onOpenFiles(null)}
          className={cn(ROW, 'w-full rounded-md px-1 text-left', ROW_INTERACTIVE)}
        >
          <span className="min-w-0 flex-1 truncate text-foreground">
            {files === null
              ? 'Open Files'
              : `${files.count} ${files.count === 1 ? 'file' : 'files'}`}
          </span>
          <ChevronRight
            size={ICON_SIZE.row}
            aria-hidden
            className="shrink-0 text-faint-foreground"
          />
        </button>
        {stats.length > 0 && (
          <ul className="hidden min-w-0 flex-col @[928px]:flex">
            {stats.map((stat) => (
              <FileStatRow key={stat.path} stat={stat} onOpen={() => onOpenFiles(stat.path)} />
            ))}
          </ul>
        )}
      </PropertyBlock>
    </aside>
  );
};
