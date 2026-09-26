import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { LensEmptyState } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { DIFF_PANE_TITLE, SessionDiffPane } from '../../../../diff/components/SessionDiffPane';
import { FileVersionsPane } from './FileVersionsPane';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { BranchSurgeryMenu } from './BranchSurgeryMenu';

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
  const amendSessionCommit = useAppStore((s) => s.amendSessionCommit);
  const squashSessionCommits = useAppStore((s) => s.squashSessionCommits);

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

  return (
    <SessionDiffPane
      sessionId={sessionId}
      workingDir={sessionDir}
      worktreePath={worktreePath}
      diffFocus={diffFocus}
      branchRevision={0}
      renderBranchActions={({ mountId, commits, onRewritten }) =>
        mountId === null ? null : (
          <BranchSurgeryMenu
            commits={commits}
            headSha={commits[0]?.sha ?? null}
            onAmend={async (sha, message) => {
              await amendSessionCommit(sessionId, { mountId, sha, message });
              onRewritten();
            }}
            onSquash={async (sha, message) => {
              await squashSessionCommits(sessionId, { mountId, sha, message });
              onRewritten();
            }}
          />
        )
      }
    />
  );
};
