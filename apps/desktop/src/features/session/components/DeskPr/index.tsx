import { REVIEW_SOURCE_LABEL } from '@goodboy/core/review-source';
import {
  Button,
  DrawerFrame,
  ErrorStrip,
  HeaderActions,
  SegmentedTabs,
  cn,
  PANE_RHYTHM,
} from '@goodboy/ui';
import type { MountId, PrCheckRun, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { PullRequestDrawerTab } from '../../../../store/slices/drawer/state';
import { branchPlace } from '../../../../store/slices/navigation/place';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { ChecksFailedNotice } from '../../../branch/components/ChecksFailedNotice';
import { DeskPrChecks } from './DeskPrChecks';
import { DeskPrConversation } from './DeskPrConversation';
import { DESK_PR_COPY } from './deskPrCopy';
import { useDeskPrSource } from './useDeskPrSource';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly tab: PullRequestDrawerTab;
  readonly check: string | null;
  readonly onClose: () => void;
};

type TabParams = {
  readonly tab: PullRequestDrawerTab;
};

type PageParams = {
  readonly tab: BranchTab;
  readonly threadId?: string | null;
};

const NO_CHECKS: ReadonlyArray<PrCheckRun> = [];

const TABS = [
  { value: 'checks', label: DESK_PR_COPY.checks },
  { value: 'conversation', label: DESK_PR_COPY.conversation },
] as const satisfies ReadonlyArray<{
  readonly value: PullRequestDrawerTab;
  readonly label: string;
}>;

export const DeskPr = ({ sessionId, mountId, tab, check, onClose }: Props) => {
  const source = useDeskPrSource({ sessionId, mountId });
  const pr = source.request;
  const mountPath = useAppStore(
    (state) =>
      (state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY).find(
        (mount) => mount.mountId === mountId,
      )?.worktreePath ?? null,
  );
  const openDrawer = useAppStore((state) => state.openDrawer);
  const navigate = useAppStore((state) => state.navigate);
  const pickTab = ({ tab: next }: TabParams) =>
    openDrawer({
      kind: 'pull-request',
      sessionId,
      payload: { mountId, tab: next, ...(check === null ? {} : { check }) },
    });
  const openPage = ({ tab: pageTab, threadId = null }: PageParams) =>
    navigate({ to: branchPlace({ sessionId, mountPath, tab: pageTab, threadId }) });
  const hostLabel =
    source.host === 'gitlab' || source.host === 'bitbucket'
      ? REVIEW_SOURCE_LABEL[source.host]
      : null;
  const action =
    pr === null ? undefined : (
      <HeaderActions
        primary={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openPage({ tab: tab === 'checks' ? 'checks' : 'pr' })}
          >
            {DESK_PR_COPY.openPullRequest}
          </Button>
        }
      />
    );
  const checksBody = () => {
    const view = source.checks;
    if (view.kind === 'failed' || view.kind === 'denied') {
      return (
        <ChecksFailedNotice
          isChecking={source.isChecking}
          error={view.error}
          onRetry={source.retry}
        />
      );
    }
    if (view.kind === 'host') {
      return (
        <p className="text-body text-muted-foreground">
          {DESK_PR_COPY.hostChecks({ host: hostLabel ?? '' })}
        </p>
      );
    }
    return (
      <DeskPrChecks
        sessionId={sessionId}
        mountId={mountId}
        checks={view.kind === 'ready' ? view.checks : NO_CHECKS}
        check={check}
        prUrl={pr?.url ?? ''}
        host={hostLabel === null ? 'github' : source.host}
        isLoading={view.kind === 'loading'}
      />
    );
  };
  const conversationBody = () => {
    const comments = source.comments;
    if (comments.kind === 'host') {
      return (
        <p className="text-body text-muted-foreground">
          {DESK_PR_COPY.hostComments({ host: hostLabel ?? '' })}
        </p>
      );
    }
    if (comments.kind === 'failed') {
      return (
        <ErrorStrip
          labels={['comments']}
          error={new Error(comments.error ?? '')}
          isBusy={source.isChecking}
          onRetry={source.retry}
        />
      );
    }
    if (comments.kind === 'loading') {
      return (
        <p role="status" className="text-body text-muted-foreground">
          {DESK_PR_COPY.readingComments}
        </p>
      );
    }
    return (
      <DeskPrConversation
        comments={comments.comments}
        onOpen={(comment) => openPage({ tab: 'comments', threadId: comment.threadId ?? null })}
      />
    );
  };
  return (
    <DrawerFrame
      title={pr === null || pr.title === '' ? DESK_PR_COPY.title : `#${pr.number} ${pr.title}`}
      icon={CONCEPT_ICONS.pr}
      {...(source.branch === null ? {} : { meta: source.branch })}
      action={action}
      toolbar={
        pr === null ? undefined : (
          <SegmentedTabs
            ariaLabel={DESK_PR_COPY.tabsLabel}
            options={TABS}
            value={tab}
            onChange={(next) => pickTab({ tab: next })}
            size="xs"
            fill
          />
        )
      }
      onClose={onClose}
    >
      <div data-desk-pr="" className={cn('flex min-w-0 flex-col', PANE_RHYTHM.body)}>
        {pr === null ? (
          <p className="text-body text-muted-foreground">{DESK_PR_COPY.noPullRequest}</p>
        ) : tab === 'checks' ? (
          checksBody()
        ) : (
          conversationBody()
        )}
      </div>
    </DrawerFrame>
  );
};
