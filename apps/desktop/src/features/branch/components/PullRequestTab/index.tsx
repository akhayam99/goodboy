import type { PullRequestFailureKind } from '@goodboy/core';
import type {
  PullRequestHost,
  PrDetail,
  PullRequestState,
  PullRequestView,
  Session,
} from '@goodboy/types';
import type { PullRequestEdit } from '../../../../store/slices/pull-request-view/state';
import type { ActiveReviewSource } from '../../../../store/slices/review-source/types';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { HostRequestSummary } from './HostRequestSummary';
import { NoPullRequest } from './NoPullRequest';
import { PullRequestPage } from './PullRequestPage';
import type { ReviewerRequest } from './ReviewersProperty';

type Props = {
  readonly session: Session;
  readonly host: PullRequestHost;
  readonly pr: PullRequestState | null;
  readonly detail: PrDetail | null;
  readonly view: PullRequestView | null;
  readonly edits: ReadonlyArray<PullRequestEdit>;
  readonly viewError: string | null;
  readonly viewErrorKind: PullRequestFailureKind | null;
  readonly mountPath: string | null;
  readonly source: ActiveReviewSource | null;
  readonly canEdit: boolean;
  readonly request: ReviewerRequest;
  readonly behind: number | null;
  readonly distanceBase?: string | null;
  readonly isConnected: boolean;
  readonly onRebase: (() => void) | null;
  readonly onMutated: () => void;
  readonly onCreated: () => void;
  readonly onConnected: () => void;
  readonly onReload: () => void;
  readonly onSelectTab: (tab: BranchTab) => void;
  readonly onOpenFiles: (path: string | null) => void;
};

export const PullRequestTab = ({
  session,
  host,
  pr,
  detail,
  view,
  edits,
  viewError,
  viewErrorKind,
  mountPath,
  source,
  canEdit,
  request,
  behind,
  distanceBase = null,
  isConnected,
  onRebase,
  onMutated,
  onCreated,
  onConnected,
  onReload,
  onSelectTab,
  onOpenFiles,
}: Props) => {
  if (source !== null && !source.capabilities.canEditTitle) {
    return <HostRequestSummary source={source} />;
  }
  if (pr === null) {
    return (
      <NoPullRequest
        session={session}
        mountPath={mountPath}
        isRepoMissing={false}
        isConnected={isConnected}
        onConnected={onConnected}
        onCreated={onCreated}
      />
    );
  }
  return (
    <PullRequestPage
      session={session}
      host={host}
      pr={pr}
      detail={detail}
      view={view}
      edits={edits}
      viewError={viewError}
      viewErrorKind={viewErrorKind}
      canEdit={canEdit}
      request={request}
      behind={behind}
      distanceBase={distanceBase}
      onRebase={onRebase}
      onMutated={onMutated}
      onReload={onReload}
      onSelectTab={onSelectTab}
      onOpenFiles={onOpenFiles}
    />
  );
};
