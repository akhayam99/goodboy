import { Button, LensEmptyState, PageColumn, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { branchPlace } from '../../../store/slices/navigation/place';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../shared/components/conceptIcons';
import type { ActionControls } from '../../actions/useActionControls';
import { RewriteHistoryPage } from '../../history/components/RewriteHistoryPage';
import { ReviewCommits } from '../../resolve/components/ReviewCommits';
import { useReviewEntries } from '../../resolve/components/ReviewFlow/useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
  readonly diffControls: ActionControls;
};

const HISTORY_ACTION_IDS = ['diff.rewriteHistory', 'diff.restoreBackup'] as const;

export const BranchCommits = ({ sessionId, worktreePath, diffControls }: Props) => {
  const { entries } = useReviewEntries({ sessionId });
  const page = useAppStore((s) => s.diffPage[sessionId] ?? null);
  const navigate = useAppStore((s) => s.navigate);
  if (worktreePath === null) {
    return (
      <PageColumn>
        <LensEmptyState
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="No worktree for this session"
          description="This session has no checked-out worktree, so there are no commits to show."
        />
      </PageColumn>
    );
  }
  if (page === 'history') {
    return <RewriteHistoryPage sessionId={sessionId} worktreePath={worktreePath} />;
  }
  const historyActions = HISTORY_ACTION_IDS.flatMap((id) => {
    const action = diffControls.actions.find((candidate) => candidate.id === id);
    return action === undefined ? [] : [action];
  });
  return (
    <PageColumn className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {historyActions.length > 0 && (
        <div className="flex min-w-0 items-center gap-2">
          {historyActions.map((action) => {
            const button = (
              <Button
                key={action.id}
                size="sm"
                variant="secondary"
                disabled={action.blockedReason !== null}
                onClick={() => diffControls.trigger({ actionId: action.id })}
              >
                <action.icon size={ICON_SIZE.row} aria-hidden />
                {action.label}
              </Button>
            );
            return action.blockedReason === null ? (
              button
            ) : (
              <Tooltip key={action.id} content={action.blockedReason} anchorClassName="inline-flex">
                {button}
              </Tooltip>
            );
          })}
        </div>
      )}
      <ReviewCommits
        sessionId={sessionId}
        entries={entries}
        onOpenThread={(threadId) =>
          navigate({ to: branchPlace({ sessionId, threadId }), mode: 'replace' })
        }
      />
    </PageColumn>
  );
};
