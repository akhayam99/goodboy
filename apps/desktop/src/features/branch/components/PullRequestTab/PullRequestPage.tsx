import { useMemo } from 'react';
import {
  PULL_REQUEST_NOUNS,
  REVIEW_SOURCE_LABEL,
  type PullRequestFailureKind,
} from '@goodboy/core';
import { SkeletonRow } from '@goodboy/ui';
import type {
  MountId,
  PrDetail,
  PullRequestHost,
  PullRequestState,
  PullRequestView,
  Session,
} from '@goodboy/types';
import type { PullRequestEdit } from '../../../../store/slices/pull-request-view/state';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { pullRequestKindOf } from '../../../../shared/utils/pullRequestKind';
import { usePullRequestPort } from '../../hooks/usePullRequestPort';
import { pullRequestRunsOf } from '../../pullRequestRunsOf';
import { queueLineOf } from '../../queueLineOf';
import type { PullRequestReadiness } from '../../hooks/usePullRequestReadiness';
import { pullRequestActivityOf } from './activityOf';
import { PullRequestActivity } from './PullRequestActivity';
import { PullRequestDescription } from './PullRequestDescription';
import { PullRequestProperties } from './PullRequestProperties';
import { PullRequestStatusStrip } from './PullRequestStatusStrip';
import { pullRequestCellsOf, type PullRequestBranchFacts } from './pullRequestCellsOf';
import type { ReviewerRequest } from './ReviewersProperty';
import { ViewErrorNotice } from './ViewErrorNotice';

export type PullRequestPageProps = {
  readonly session: Session;
  readonly host: PullRequestHost;
  readonly pr: PullRequestState;
  readonly mountId: MountId | null;
  readonly readiness: PullRequestReadiness;
  readonly branch: PullRequestBranchFacts;
  readonly mergeWord: string;
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
  mergeWord,
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
  const { readiness, commentsNeedYou, facts, reviewers } = prReadiness;
  const runs = pullRequestRunsOf({ pr, detail, view });
  const matched = detail !== null && detail.prNumber === pr.number ? detail : null;
  const cells = pullRequestCellsOf({
    state: pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft }),
    pr,
    runs,
    isChecksUnread:
      pr.checksUnknown === true ||
      (matched?.checksRead ?? 'ok') !== 'ok' ||
      (view !== null && view.checks.read !== 'ok'),
    people: reviewers.people,
    readiness,
    hasConflicts: facts.hasConflicts,
    mergeWord,
    queueLine: queueLineOf({ pr }),
    branch,
  });
  const items = useMemo(
    () =>
      view === null
        ? []
        : pullRequestActivityOf({
            view,
            detail,
            runs,
            needYou: commentsNeedYou,
            edits,
          }),
    [commentsNeedYou, detail, edits, runs, view],
  );
  const nouns = port?.nouns ?? PULL_REQUEST_NOUNS[host];

  return (
    <div data-slot="overview-grid" className="@container flex min-w-0 flex-col gap-6">
      <PullRequestStatusStrip cells={cells} onOpen={onSelectTab} />
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
          ) : view === null ? (
            <SkeletonRow label={ACTIVITY_LOADING} />
          ) : (
            <PullRequestActivity
              items={items}
              nouns={nouns}
              baseBranch={pr.baseBranch}
              onOpenComments={() => onSelectTab('comments')}
              onOpenChecks={() => onSelectTab('checks')}
            />
          )}
        </div>
      </div>
    </div>
  );
};
