import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChevronLeft, Folder, FolderGit2, Plus } from 'lucide-react';
import { AnchoredPopover, Tooltip, cn, useDropdown } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useMountDiffStats } from '../../../../store';
import type { LensKind } from '../../../../store';
import { useActiveMount } from '../../hooks/useActiveMount';
import { MountProjectList } from '../SessionWorkspace/parts/ProjectsPane/MountProjectList';
import { ProjectChipRow } from './ProjectChipRow';
import { VITAL_CHIP } from './vitalChip';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const ProjectChip = ({ sessionId, workspaceId, onSelectLens }: Props) => {
  const projects = useAppStore(
    useShallow((state) => state.projects.filter((project) => project.workspaceId === workspaceId)),
  );
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const activeMount = useActiveMount({ sessionId });
  const diffStats = useMountDiffStats(sessionId);
  const dropdown = useDropdown({ width: 'w-80', expectedHeight: 320 });
  const [view, setView] = useState<'mounts' | 'mount'>('mounts');

  if (projects.length === 0) {
    return null;
  }

  const activeProject = projects.find((project) => project.id === activeMount?.projectId) ?? null;
  const label =
    activeMount == null ? 'No project mounted' : (activeProject?.name ?? activeMount.mountName);
  const extraCount = activeMount == null ? 0 : mounts.length - 1;
  const unmounted = projects.filter((project) =>
    mounts.every((mount) => mount.projectId !== project.id),
  );
  const GlyphIcon = activeProject?.kind === 'repo' ? FolderGit2 : Folder;
  const isMountView = activeMount == null || view === 'mount';

  const openPopover = () => {
    setView('mounts');
    dropdown.toggle();
  };

  const openProjectsPage = () => {
    dropdown.close();
    onSelectLens('projects');
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Session projects"
      anchorClassName="min-w-0 shrink"
      trigger={
        <Tooltip
          content={activeMount == null ? 'Nothing mounted yet' : activeMount.worktreePath}
          side="top"
        >
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            onClick={openPopover}
            className={cn(VITAL_CHIP, 'min-w-0 max-w-full shrink')}
          >
            <GlyphIcon size={11} aria-hidden className="shrink-0" />
            <span className="min-w-0 truncate">{label}</span>
            {extraCount > 0 ? <span className="shrink-0">+{extraCount}</span> : null}
          </button>
        </Tooltip>
      }
    >
      <div className="flex flex-col">
        {isMountView ? (
          <>
            {activeMount != null ? (
              <button
                type="button"
                onClick={() => setView('mounts')}
                className="flex items-center gap-1.5 border-b border-border-soft px-3 py-2 text-left text-xs text-muted-foreground motion-safe:transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <ChevronLeft size={12} aria-hidden className="shrink-0" />
                Mounted projects
              </button>
            ) : null}
            {unmounted.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Every project is already mounted
              </p>
            ) : (
              <MountProjectList
                sessionId={sessionId}
                projects={unmounted}
                onDone={() => setView('mounts')}
              />
            )}
          </>
        ) : (
          <>
            <ul className="flex flex-col py-1">
              {mounts.map((mount) => {
                const project =
                  projects.find((candidate) => candidate.id === mount.projectId) ?? null;
                const stat = diffStats.get(mount.worktreePath);
                return (
                  <ProjectChipRow
                    key={mount.projectId}
                    sessionId={sessionId}
                    workspaceId={workspaceId}
                    mount={mount}
                    name={project?.name ?? mount.mountName}
                    kind={project?.kind ?? null}
                    isPrimary={mount.projectId === activeMount?.projectId}
                    isDirty={stat != null && (stat.additions > 0 || stat.deletions > 0)}
                    stat={stat ?? null}
                    onClose={dropdown.close}
                  />
                );
              })}
            </ul>
            {unmounted.length > 0 ? (
              <button
                type="button"
                onClick={() => setView('mount')}
                className="flex items-center gap-2 border-t border-border-soft px-3 py-2 text-left text-xs text-muted-foreground motion-safe:transition-colors hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <Plus size={12} aria-hidden className="shrink-0" />
                Mount another project
              </button>
            ) : null}
          </>
        )}
        <button
          type="button"
          onClick={openProjectsPage}
          className="border-t border-border-soft px-3 py-1.5 text-left text-2xs text-muted-foreground/70 motion-safe:transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
        >
          Open projects page
        </button>
      </div>
    </AnchoredPopover>
  );
};
