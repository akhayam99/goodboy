import { Button, DrawerFrame, HeaderActions, SegmentedTabs, cn, PANE_RHYTHM } from '@goodboy/ui';
import type { MountId, PrCheckRun, PrComment, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { PullRequestDrawerTab } from '../../../../store/slices/drawer/state';
import { branchPlace } from '../../../../store/slices/navigation/place';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { DeskPrChecks } from './DeskPrChecks';
import { DeskPrConversation } from './DeskPrConversation';
import { DESK_PR_COPY } from './deskPrCopy';

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

const NO_COMMENTS: ReadonlyArray<PrComment> = [];

const TABS = [
  { value: 'checks', label: DESK_PR_COPY.checks },
  { value: 'conversation', label: DESK_PR_COPY.conversation },
] as const satisfies ReadonlyArray<{
  readonly value: PullRequestDrawerTab;
  readonly label: string;
}>;

export const DeskPr = ({ sessionId, mountId, tab, check, onClose }: Props) => {
  const pr = useAppStore((state) => state.mountGithub[mountId]?.pr ?? null);
  const branch = useAppStore((state) => state.mountGithub[mountId]?.branch ?? null);
  const checks = useAppStore((state) => state.mountGithub[mountId]?.detail?.checks ?? NO_CHECKS);
  const comments = useAppStore(
    (state) => state.mountGithub[mountId]?.detail?.comments ?? NO_COMMENTS,
  );
  const isLoading = useAppStore((state) => state.mountGithub[mountId]?.detailLoading === true);
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
  return (
    <DrawerFrame
      title={pr === null ? DESK_PR_COPY.title : `#${pr.number} ${pr.title}`}
      icon={CONCEPT_ICONS.pr}
      {...(branch === null ? {} : { meta: branch })}
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
          <DeskPrChecks
            sessionId={sessionId}
            mountId={mountId}
            checks={checks}
            check={check}
            prUrl={pr.url}
            isLoading={isLoading}
          />
        ) : (
          <DeskPrConversation
            comments={comments}
            onOpen={(comment) => openPage({ tab: 'comments', threadId: comment.threadId ?? null })}
          />
        )}
      </div>
    </DrawerFrame>
  );
};
