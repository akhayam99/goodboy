import type { SessionId, SessionProjectMount } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { LensEmptyState } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { DiffViewerPane } from '../../../../permissions/components/DiffViewerDialog';
import { DIFF_VIEWER_PANE_COPY } from '../../../../permissions/components/DiffViewerDialog/diffViewerPaneCopy';
import { DiffMountSwitcher } from './DiffMountSwitcher';
import { FileVersionsPane } from './FileVersionsPane';
import { PaneShell } from '../../../../../shared/components/PaneShell';

const EMPTY_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

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
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[sessionId] ?? EMPTY_MOUNTS);

  if (isBranchless) {
    if (sessionDir == null) {
      return (
        <PaneShell
          title="File versions"
          description="View and restore saved file copies for this session."
        >
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
      <PaneShell
        title={DIFF_VIEWER_PANE_COPY.title}
        description={DIFF_VIEWER_PANE_COPY.description}
      >
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
    <div className="flex h-full min-h-0 w-full flex-col">
      {mounts.length > 1 ? (
        <DiffMountSwitcher
          sessionId={sessionId}
          mounts={mounts}
          selectedWorktreePath={worktreePath}
        />
      ) : null}
      <div className="min-h-0 flex-1">
        <DiffViewerPane
          sessionId={sessionId}
          workingDir={sessionDir ?? undefined}
          worktreePath={worktreePath}
          diffFocus={diffFocus}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
