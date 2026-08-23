import { useEffect } from 'react';
import { Check, Copy, Folder, FolderGit2, FolderTree, GitBranch } from 'lucide-react';
import { cn, Tooltip, useCopyLink } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { VITAL_CHIP, VITAL_CHIP_FOCUS, VITAL_CHIP_FRAME, VITAL_CHIP_HOVER } from './vitalChip';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const ProjectScopeChip = ({ sessionId, workspaceId, onSelectLens }: Props) => {
  const { showToast } = useToast();
  const { copied, failed, copy } = useCopyLink();
  const projectCount = useAppStore(
    (s) => s.projects.filter((project) => project.workspaceId === workspaceId).length,
  );
  const mountCount = useAppStore((s) => (s.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY).length);
  const activeMount = useAppStore((s) => {
    const mounts = s.sessionProjectMounts[sessionId];
    if (mounts == null || mounts.length === 0) {
      return null;
    }
    const session = s.sessions.find((candidate) => candidate.id === sessionId);
    const activeId = s.sessionActiveProject[sessionId] ?? session?.activeProjectId;
    return mounts.find((mount) => mount.projectId === activeId) ?? mounts[0] ?? null;
  });
  const activeKind = useAppStore(
    (s) => s.projects.find((project) => project.id === activeMount?.projectId)?.kind ?? null,
  );

  useEffect(() => {
    if (copied) {
      showToast('success', 'branch copied');
    }
  }, [copied, showToast]);

  useEffect(() => {
    if (failed) {
      showToast('error', 'copy failed');
    }
  }, [failed, showToast]);

  if (projectCount === 0) {
    return null;
  }

  if (activeMount == null) {
    return (
      <button type="button" onClick={() => onSelectLens('projects')} className={VITAL_CHIP}>
        <FolderTree size={11} aria-hidden />
        <span>No projects mounted</span>
      </button>
    );
  }

  const branch = activeMount.branch;
  const extraCount = mountCount - 1;
  const GlyphIcon = activeKind === 'repo' ? FolderGit2 : Folder;

  return (
    <span
      className={cn(
        VITAL_CHIP_FRAME,
        'group/scope min-w-0 max-w-full shrink',
        copied ? 'border-success/30 bg-success/10 text-success' : VITAL_CHIP_HOVER,
      )}
    >
      <button
        type="button"
        onClick={() => onSelectLens('projects')}
        className={cn('inline-flex min-w-0 items-center gap-1.5 rounded-md px-2', VITAL_CHIP_FOCUS)}
      >
        <GlyphIcon size={11} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">{activeMount.mountName}</span>
        {branch !== '' ? (
          <>
            <GitBranch size={11} aria-hidden className="shrink-0" />
            <span className="min-w-0 truncate font-mono">{branch}</span>
          </>
        ) : null}
        {extraCount > 0 ? <span className="shrink-0">+{extraCount}</span> : null}
      </button>
      {branch !== '' ? (
        <Tooltip content={copied ? 'Copied' : 'Copy the branch name'} side="top">
          <button
            type="button"
            onClick={() => void copy(branch)}
            aria-label={`Copy branch ${branch}`}
            className={cn(
              'inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/50',
              'opacity-0 transition-[opacity,color,background-color] hover:bg-muted hover:text-foreground',
              'focus-visible:opacity-100',
              VITAL_CHIP_FOCUS,
              'group-hover/scope:opacity-100 motion-reduce:opacity-60',
            )}
          >
            {copied ? <Check size={10} aria-hidden /> : <Copy size={10} aria-hidden />}
          </button>
        </Tooltip>
      ) : null}
    </span>
  );
};
