import { useMemo } from 'react';
import {
  PULL_REQUEST_NOUNS,
  REVIEW_SOURCE_LABEL,
  type PullRequestFailureKind,
} from '@goodboy/core';
import { SkeletonRow } from '@goodboy/ui';
import type {
  PrDetail,
  PullRequestHost,
  PullRequestState,
  PullRequestView,
  Session,
} from '@goodboy/types';
import type { PullRequestEdit } from '../../../../store/slices/pull-request-view/state';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { usePullRequestPort } from '../../hooks/usePullRequestPort';
import { pullRequestRunsOf } from '../../pullRequestRunsOf';
import { usePullRequestReadiness } from '../../hooks/usePullRequestReadiness';
import { pullRequestActivityOf } from './activityOf';
import { PullRequestActivity } from './PullRequestActivity';
import { PullRequestDescription } from './PullRequestDescription';
import { PullRequestProperties } from './PullRequestProperties';
import type { ReviewerRequest } from './ReviewersProperty';
import { ViewErrorNotice } from './ViewErrorNotice';

export type PullRequestPageProps = {
  readonly session: Session;
  readonly host: PullRequestHost;
  readonly pr: PullRequestState;
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
  const port = usePullRequestPort({ sessionId });
  const { readiness, commentsNeedYou } = usePullRequestReadiness({ sessionId });
  const items = useMemo(
    () =>
      view === null
        ? []
        : pullRequestActivityOf({
            view,
            detail,
            runs: pullRequestRunsOf({ pr, detail, view }),
            needYou: commentsNeedYou,
            edits,
          }),
    [commentsNeedYou, detail, edits, pr, view],
  );
  const nouns = port?.nouns ?? PULL_REQUEST_NOUNS[host];

  return (
    <div data-slot="overview-grid" className="flex min-w-0 flex-col gap-8">
      <PullRequestProperties
        sessionId={sessionId}
        host={host}
        pr={pr}
        detail={detail}
        view={view}
        port={port}
        request={request}
        readiness={readiness}
        canEdit={canEdit}
        onOpenChecks={() => onSelectTab('checks')}
        onMutated={onMutated}
      />
      <div className="flex min-w-0 flex-col gap-8">
        <PullRequestDescription
          sessionId={sessionId}
          workspaceId={session.workspaceId}
          pr={pr}
          canEdit={canEdit}
          hostName={REVIEW_SOURCE_LABEL[host]}
          onSaved={onMutated}
        />
        {view === null && viewError !== null ? (
          <ViewErrorNotice host={host} kind={viewErrorKind} error={viewError} onReload={onReload} />
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
  );
};
