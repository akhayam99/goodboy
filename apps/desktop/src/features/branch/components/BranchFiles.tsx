import { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button, LensEmptyState, PageColumn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { useActionEnv } from '../../actions/useActionEnv';
import { useObjectActions } from '../../actions/useObjectActions';
import { SessionDiffPane } from '../../diff/components/SessionDiffPane';
import type { SessionDiff } from '../../diff/hooks/useSessionDiff';
import { WriteReview } from '../../review/components/ReviewPane/WriteReview';
import { BranchFileTree } from './BranchFileTree';

type Props = {
  readonly session: Session;
  readonly workingDir: string | null;
  readonly worktreePath: string | null;
  readonly diff: SessionDiff;
  readonly hasPullRequest: boolean;
};

export const BranchFiles = ({ session, workingDir, worktreePath, diff, hasPullRequest }: Props) => {
  const sessionId = session.id as SessionId;
  const [activePath, setActivePath] = useState<string | null>(null);
  const mode = useAppStore((s) => s.pullRequestModes[sessionId] ?? 'overview');
  const setPullRequestMode = useAppStore((s) => s.setPullRequestMode);
  const env = useActionEnv({ origin: 'button' });
  const reviewTarget = useMemo(() => ({ kind: 'review' as const, sessionId }), [sessionId]);
  const { actions, run } = useObjectActions({ target: reviewTarget, env });
  const postNotes = actions.find((action) => action.id === 'review.postNotes') ?? null;
  if (worktreePath === null) {
    return (
      <PageColumn width="full">
        <LensEmptyState
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="No worktree for this session"
          description="This session has no checked-out worktree, so there is no diff to show."
        />
      </PageColumn>
    );
  }
  if (mode === 'write_review' && hasPullRequest) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <PageColumn width="full">
          <button
            type="button"
            onClick={() => setPullRequestMode({ sessionId, mode: 'overview' })}
            className="inline-flex items-center gap-1 rounded-sm text-meta text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ChevronLeft size={ICON_SIZE.row} aria-hidden />
            Files
          </button>
        </PageColumn>
        <WriteReview session={session} />
      </div>
    );
  }
  const hasTree = !diff.loading && diff.error === null && diff.files.length > 0;
  const pick = (path: string): void => {
    setActivePath(path);
    diff.focusFile(path);
  };
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {hasTree && (
        <aside aria-label="Files" className="hidden min-h-0 w-[240px] shrink-0 pl-3 @4xl:flex">
          <BranchFileTree
            files={diff.files}
            isViewed={(file) => diff.viewed.stateOf(file) === 'viewed'}
            activePath={activePath}
            onPick={pick}
          />
        </aside>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SessionDiffPane
          sessionId={sessionId}
          workingDir={workingDir}
          worktreePath={worktreePath}
          diff={diff}
          onWriteReview={
            hasPullRequest ? () => setPullRequestMode({ sessionId, mode: 'write_review' }) : null
          }
          toolbarExtra={
            postNotes === null ? null : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void run({ actionId: postNotes.id })}
              >
                {postNotes.label}
              </Button>
            )
          }
        />
      </div>
    </div>
  );
};
