import type { PrDetail, PullRequestState, PullRequestView, Session } from '@goodboy/types';
import type { PullRequestEdit } from '../../../../store/slices/pull-request-view/state';
import type { ActiveReviewSource } from '../../../../store/slices/review-source/types';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { HostRequestSummary } from './HostRequestSummary';
import { NoPullRequest } from './NoPullRequest';
import { PullRequestPage } from './PullRequestPage';
import type { ReviewerRequest } from './ReviewersProperty';

type Props = {
  readonly session: Session;
  readonly pr: PullRequestState | null;
  readonly detail: PrDetail | null;
  readonly view: PullRequestView | null;
  readonly edits: ReadonlyArray<PullRequestEdit>;
  readonly viewError: string | null;
  readonly mountPath: string | null;
  readonly source: ActiveReviewSource | null;
  readonly canEdit: boolean;
  readonly request: ReviewerRequest;
  readonly behind: number | null;
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
  pr,
  detail,
  view,
  edits,
  viewError,
  mountPath,
  source,
  canEdit,
  request,
  behind,
  isConnected,
  onRebase,
  onMutated,
  onCreated,
  onConnected,
  onReload,
  onSelectTab,
  onOpenFiles,
}: Props) => {
  if (source !== null && source.kind !== 'github') {
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
      pr={pr}
      detail={detail}
      view={view}
      edits={edits}
      viewError={viewError}
      canEdit={canEdit}
      request={request}
      behind={behind}
      onRebase={onRebase}
      onMutated={onMutated}
      onReload={onReload}
      onSelectTab={onSelectTab}
      onOpenFiles={onOpenFiles}
    />
  );
};
