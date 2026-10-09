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
  readonly behind: number | null;
  readonly distanceBase?: string | null;
  readonly onRebase: (() => void) | null;
  readonly onMutated: () => void;
  readonly onReload: () => void;
  readonly onSelectTab: (tab: BranchTab) => void;
  readonly onOpenFiles: (path: string | null) => void;
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
  behind,
  distanceBase = null,
  onRebase,
  onMutated,
  onReload,
  onSelectTab,
  onOpenFiles,
}: PullRequestPageProps) => {
  const sessionId = session.id;
  const port = usePullRequestPort({ sessionId });
  const { readiness, commentsNeedYou } = usePullRequestReadiness({ sessionId });
  const items = useMemo(
    () =>
      view === null ? [] : pullRequestActivityOf({ view, detail, needYou: commentsNeedYou, edits }),
    [commentsNeedYou, detail, edits, view],
  );
  const nouns = port?.nouns ?? PULL_REQUEST_NOUNS[host];

  return (
    <div className="flex min-w-0 flex-col gap-6 @[928px]:grid @[928px]:grid-cols-[minmax(0,1fr)_280px] @[928px]:items-start @[928px]:gap-8">
      <PullRequestProperties
        sessionId={sessionId}
        host={host}
        pr={pr}
        detail={detail}
        view={view}
        readiness={readiness}
        port={port}
        request={request}
        canEdit={canEdit}
        behind={behind}
        distanceBase={distanceBase}
        onRebase={onRebase}
        onOpenChecks={() => onSelectTab('checks')}
        onOpenFiles={onOpenFiles}
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
