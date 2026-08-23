import { FolderTree } from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { VITAL_CHIP } from './vitalChip';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const ScopeSummary = ({ sessionId, workspaceId, onSelectLens }: Props) => {
  const mountCount = useAppStore((s) => (s.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY).length);
  const projectCount = useAppStore(
    (s) => s.projects.filter((project) => project.workspaceId === workspaceId).length,
  );

  if (projectCount === 0) {
    return null;
  }

  const label =
    mountCount === 0
      ? 'No projects mounted'
      : `Scoped to ${mountCount} ${mountCount === 1 ? 'project' : 'projects'}`;

  return (
    <button type="button" onClick={() => onSelectLens('projects')} className={VITAL_CHIP}>
      <FolderTree size={11} aria-hidden />
      <span>{label}</span>
    </button>
  );
};
