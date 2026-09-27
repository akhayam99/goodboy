import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { LensEmptyState } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { DIFF_PANE_TITLE, SessionDiffPane } from '../../../../diff/components/SessionDiffPane';
import { FileVersionsPane } from './FileVersionsPane';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { RewriteHistoryPage } from '../../../../history/components/RewriteHistoryPage';
import { RewriteHistoryButton } from '../../../../history/components/RewriteHistoryButton';

type Props = {
  readonly sessionId: SessionId;
  readonly sessionDir: string | null;
  readonly worktreePath: string | null;
  readonly isBranchless: boolean;
  readonly onClose: () => void;
};

export const FilesPane = ({
  sessionId,
  sessionDir,
  worktreePath,
  isBranchless,
  onClose,
}: Props) => {
  const diffFocus = useAppStore((s) => s.diffFocus[sessionId] ?? null);
  const diffPage = useAppStore((s) => s.diffPage[sessionId] ?? null);
  const openRewriteHistory = useAppStore((s) => s.openRewriteHistory);

  if (isBranchless) {
    if (sessionDir == null) {
      return (
        <PaneShell title="File versions">
          <LensEmptyState
            tone={CONCEPT_TONE.diff}
            icon={CONCEPT_ICONS.diff}
            title="Session directory missing"
            description="This session directory is not available, so file versions cannot be loaded."
          />
        </PaneShell>
      );
    }
    return <FileVersionsPane sessionId={sessionId} sessionDir={sessionDir} onClose={onClose} />;
  }
  if (worktreePath == null) {
    return (
      <PaneShell title={DIFF_PANE_TITLE}>
        <LensEmptyState
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="No worktree for this session"
          description="This session has no checked-out worktree, so there is no diff to show."
        />
      </PaneShell>
    );
  }

  if (diffPage === 'history') {
    return <RewriteHistoryPage sessionId={sessionId} worktreePath={worktreePath} />;
  }

  return (
    <SessionDiffPane
      sessionId={sessionId}
      workingDir={sessionDir}
      worktreePath={worktreePath}
      diffFocus={diffFocus}
      branchRevision={0}
      renderBranchActions={({ mountId, commits }) =>
        mountId === null || commits.length === 0 ? null : (
          <RewriteHistoryButton
            count={commits.length}
            onOpen={() => openRewriteHistory(sessionId, worktreePath)}
          />
        )
      }
    />
  );
};
