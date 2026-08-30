import { useState } from 'react';
import { Folder, FolderGit2, MoreHorizontal } from 'lucide-react';
import { OverflowMenu, Tooltip, cn, formatError } from '@goodboy/ui';
import type { OverflowMenuItem } from '@goodboy/ui';
import type { Project, PullRequestState, SessionId, SessionProjectMount } from '@goodboy/types';
import type { LensKind, MountDiffStat } from '../../../../../store';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { PullRequestChip } from '../../../../github/components/PullRequestChip';
import { DiffStat } from '../../DiffStat';
import { ProjectBranchChip } from './ProjectBranchChip';
import { ProjectSyncControl } from './ProjectSyncControl';

type Props = {
  readonly sessionId: SessionId;
  readonly project: Project | null;
  readonly mount: SessionProjectMount;
  readonly diffStat: MountDiffStat | null;
  readonly pullRequest: PullRequestState | null;
  readonly onSelectLens: (lens: LensKind) => void;
};

const ICON_BUTTON =
  'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

export const ProjectMountRow = ({
  sessionId,
  project,
  mount,
  diffStat,
  pullRequest,
  onSelectLens,
}: Props) => {
  const setSessionActiveProject = useAppStore((state) => state.setSessionActiveProject);
  const detachProject = useAppStore((state) => state.detachProject);
  const openMountDiff = useAppStore((state) => state.openMountDiff);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const [isDetaching, setIsDetaching] = useState(false);
  const GlyphIcon = project?.kind === 'repo' ? FolderGit2 : Folder;
  const projectName = project?.name ?? mount.mountName;
  const changes = diffStat != null && (diffStat.additions > 0 || diffStat.deletions > 0);

  const openLens = async ({ lens }: { readonly lens: LensKind }) => {
    await setSessionActiveProject({ sessionId, projectId: mount.projectId });
    onSelectLens(lens);
  };
  const detach = async () => {
    setIsDetaching(true);
    try {
      await detachProject({ sessionId, projectId: mount.projectId });
    } catch (error) {
      void emitNotification(
        'error',
        'warning',
        'could not detach the project',
        formatError(error),
        { sessionId, workspaceId: project?.workspaceId },
      );
    } finally {
      setIsDetaching(false);
    }
  };
  const menuItems: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'detach',
      label: isDetaching ? `Detaching ${projectName}` : 'Detach project',
      onClick: () => void detach(),
      disabled: isDetaching,
    },
  ];

  return (
    <div
      data-testid="project-mount-row"
      className="flex min-h-12 w-full items-center gap-3 border-b border-border-soft px-3 py-2 last:border-b-0"
    >
      <div className="flex min-w-36 flex-1 items-center gap-2">
        <GlyphIcon size={14} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium text-foreground">{projectName}</span>
      </div>
      <ProjectBranchChip
        sessionId={sessionId}
        projectId={mount.projectId}
        branch={mount.branch}
        canSwitch={project?.kind === 'repo'}
      />
      {project?.kind === 'repo' ? (
        <ProjectSyncControl
          sessionId={sessionId}
          projectId={mount.projectId}
          worktreePath={mount.worktreePath}
        />
      ) : null}
      {changes ? (
        <Tooltip content={`View changes in ${projectName}`}>
          <button
            type="button"
            aria-label={`View the changes of ${projectName}`}
            onClick={() => openMountDiff(sessionId, mount.worktreePath)}
            className="rounded-md px-1.5 py-1 text-xs tabular-nums hover:bg-muted/40"
          >
            <DiffStat
              additions={diffStat.additions}
              deletions={diffStat.deletions}
              size="inherit"
            />
          </button>
        </Tooltip>
      ) : (
        <span className="text-xs text-muted-foreground/50">No changes</span>
      )}
      {pullRequest != null ? (
        <button
          type="button"
          aria-label={`Open PR #${pullRequest.number}`}
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('goodboy:open-github-session', {
                detail: { sessionId, prNumber: pullRequest.number },
              }),
            )
          }
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs hover:bg-muted/40"
        >
          <PullRequestChip
            state={pullRequest.isDraft ? 'draft' : pullRequest.state}
            variant="badge"
            iconSize={9}
          />
          <span className="font-mono">#{pullRequest.number}</span>
        </button>
      ) : null}
      <Tooltip content={`Open terminal in ${projectName}`}>
        <button
          type="button"
          aria-label={`Open terminal for ${projectName}`}
          onClick={() => void openLens({ lens: 'terminal' })}
          className={ICON_BUTTON}
        >
          <CONCEPT_ICONS.terminal size={13} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content={`Open scripts for ${projectName}`}>
        <button
          type="button"
          aria-label={`Open scripts for ${projectName}`}
          onClick={() => void openLens({ lens: 'scripts' })}
          className={ICON_BUTTON}
        >
          <CONCEPT_ICONS.scripts size={13} aria-hidden />
        </button>
      </Tooltip>
      <OverflowMenu
        items={menuItems}
        label={`${projectName} actions`}
        triggerClassName={cn(ICON_BUTTON)}
        trigger={<MoreHorizontal size={14} aria-hidden />}
      />
    </div>
  );
};
