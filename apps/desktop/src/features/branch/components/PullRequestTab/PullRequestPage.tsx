import { useMemo } from 'react';
import {
  PULL_REQUEST_NOUNS,
  REVIEW_SOURCE_LABEL,
  type PullRequestFailureKind,
} from '@goodboy/core/review-source';
import { SkeletonSwap } from '@goodboy/ui';
import type {
  MountId,
  PrDetail,
  PullRequestHost,
  PullRequestState,
  PullRequestView,
  Session,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { pullRequestViewOf } from '../../../../store/slices/pull-request-view/pullRequestViewOf';
import type { PullRequestEdit } from '../../../../store/slices/pull-request-view/state';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { pullRequestKindOf } from '../../../../shared/utils/pullRequestKind';
import type { BranchDueStep } from '../../branchStepOf';
import { usePullRequestPort } from '../../hooks/usePullRequestPort';
import { pullRequestRunsOf } from '../../pullRequestRunsOf';
import { pullRequestThreadCountsOf } from '../../pullRequestThreadCountsOf';
import { queueLineOf } from '../../queueLineOf';
import type { PullRequestReadiness } from '../../hooks/usePullRequestReadiness';
import { PR_REQUEST_REVIEW_EVENT, pullRequestEventName } from '../../../actions/kinds/pullRequest';
import type { ThreadEntry } from '../../../resolve/commentGroupsView';
import { pullRequestActivityOf } from './activityOf';
import { MergeBox } from './MergeBox';
import { mergeBoxOf, type PullRequestBranchFacts } from './MergeBox/mergeBoxOf';
import { PullRequestActivity } from './PullRequestActivity';
import { PullRequestActivitySkeleton } from './PullRequestActivitySkeleton';
import { PullRequestDescription } from './PullRequestDescription';
import { PullRequestProperties } from './PullRequestProperties';
import type { ReviewerRequest } from './ReviewersProperty';
import { ViewErrorNotice } from './ViewErrorNotice';

export type PullRequestPageProps = {
  readonly session: Session;
  readonly host: PullRequestHost;
  readonly pr: PullRequestState;
  readonly mountId: MountId | null;
  readonly readiness: PullRequestReadiness;
  readonly branch: PullRequestBranchFacts;
  readonly steps: ReadonlyArray<BranchDueStep>;
  readonly mergeWord: string;
  readonly entries: ReadonlyArray<ThreadEntry>;
  readonly detail: PrDetail | null;
  readonly view: PullRequestView | null;
  readonly edits: ReadonlyArray<PullRequestEdit>;
  readonly viewError: string | null;
  readonly viewErrorKind: PullRequestFailureKind | null;
  readonly canEdit: boolean;
  readonly request: ReviewerRequest;
  readonly onMutated: () => void;
  readonly onReload: () => void;
  readonly onSelectTab: (tab: BranchTab) => void;
};

const ACTIVITY_LOADING = 'Reading the activity';

export const PullRequestPage = ({
  session,
  host,
  pr,
  mountId,
  readiness: prReadiness,
  branch,
  steps,
  mergeWord,
  entries,
  detail,
  view,
  edits,
  viewError,
  viewErrorKind,
  canEdit,
  request,
  onMutated,
  onReload,
  onSelectTab,
}: PullRequestPageProps) => {
  const sessionId = session.id;
  const port = usePullRequestPort({ sessionId, mountId });
  const { readiness, commentsUnread, facts, reviewers } = prReadiness;
  const runs = pullRequestRunsOf({ pr, detail, view });
  const matched = detail !== null && detail.prNumber === pr.number ? detail : null;
  const comments = matched?.comments ?? null;
  const hostCounts = useMemo(
    () => pullRequestThreadCountsOf({ pr, detail, entries, isWithNotes: false }),
    [detail, entries, pr],
  );
  const threads = useMemo(
    () => ({
      unresolved: hostCounts.open,
      needYou: hostCounts.needYou,
      unread: commentsUnread,
    }),
    [commentsUnread, hostCounts],
  );
  const box = mergeBoxOf({
    state: pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft }),
    pr,
    runs,
    isChecksUnread:
      pr.checksUnknown === true ||
      (matched?.checksRead ?? 'ok') !== 'ok' ||
      (view !== null && view.checks.read !== 'ok'),
    checks: {
      checks: facts.checks,
      failingChecks: facts.failingChecks,
      runningChecks: facts.runningChecks,
    },
    reviewers: [...reviewers.people, ...reviewers.bots.filter((bot) => bot.state !== 'commented')],
    readiness,
    hasConflicts: facts.hasConflicts,
    mergeWord,
    queueLine: queueLineOf({ pr }),
    branch,
    steps,
    threads,
    unpushed: facts.unpushed,
    canRequestReview: request.kind === 'allowed',
  });

  const items = useMemo(
    () =>
      view === null
        ? []
        : pullRequestActivityOf({
            view,
            detail,
            runs,
            threads: { open: hostCounts.open, needYou: hostCounts.needYou },
            entries,
            edits,
          }),
    [detail, edits, entries, hostCounts, runs, view],
  );
  const viewEntry = useAppStore((state) =>
    pullRequestViewOf({ state, sessionId, mountId, prNumber: pr.number }),
  );
  const setActivityFilter = useAppStore((state) => state.setPullRequestActivityFilter);
  const nouns = port?.nouns ?? PULL_REQUEST_NOUNS[host];

  return (
    <div data-slot="overview-grid" className="@container flex min-w-0 flex-col gap-6">
      <MergeBox
        box={box}
        onOpen={(target) => {
          if (target === 'reviewers') {
            window.dispatchEvent(
              new Event(pullRequestEventName({ name: PR_REQUEST_REVIEW_EVENT, sessionId })),
            );
            return;
          }
          onSelectTab(target);
        }}
      />
      <div
        data-slot="page-columns"
        className="grid min-w-0 grid-cols-1 gap-8 @[880px]:grid-cols-[minmax(0,1fr)_224px]"
      >
        <div className="order-1 min-w-0 @[880px]:order-2">
          <PullRequestProperties
            sessionId={sessionId}
            mountId={mountId}
            pr={pr}
            view={view}
            port={port}
            request={request}
            reviewers={reviewers}
            comments={comments}
            entries={entries}
            isLoaded={matched !== null || view !== null}
            canEdit={canEdit}
            onMutated={onMutated}
          />
        </div>
        <div
          data-slot="reading-column"
          className="order-2 flex min-w-0 max-w-prose flex-col gap-8 @[880px]:order-1"
        >
          <PullRequestDescription
            sessionId={sessionId}
            workspaceId={session.workspaceId}
            pr={pr}
            canEdit={canEdit}
            hostName={REVIEW_SOURCE_LABEL[host]}
            onSaved={onMutated}
          />
          {view === null && viewError !== null ? (
            <ViewErrorNotice
              host={host}
              kind={viewErrorKind}
              error={viewError}
              onReload={onReload}
            />
          ) : (
            <SkeletonSwap
              gateKey={`pr-activity:${sessionId}:${pr.number}`}
              isLoaded={view !== null}
              skeleton={<PullRequestActivitySkeleton label={ACTIVITY_LOADING} />}
            >
              {view === null ? null : (
                <PullRequestActivity
                  items={items}
                  nouns={nouns}
                  baseBranch={pr.baseBranch}
                  onOpenComments={() => onSelectTab('comments')}
                  onOpenChecks={() => onSelectTab('checks')}
                  chosen={viewEntry?.activityFilter ?? 'all'}
                  onChoose={(next) =>
                    setActivityFilter({
                      sessionId,
                      prNumber: pr.number,
                      mountId: viewEntry?.mountId ?? null,
                      filter: next,
                    })
                  }
                />
              )}
            </SkeletonSwap>
          )}
        </div>
      </div>
    </div>
  );
};
