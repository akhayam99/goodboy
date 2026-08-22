import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { AddProjectChip } from './AddProjectChip';

const EMPTY_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

type Props = {
  readonly sessionId: SessionId;
};

export const ProjectSwitcher = ({ sessionId }: Props) => {
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_MOUNTS);
  const activeWorkspaceId = useAppStore((state) => state.sessionActiveProject[sessionId] ?? null);
  const setSessionActiveProject = useAppStore((state) => state.setSessionActiveProject);

  const activeMount =
    mounts.find((mount) => mount.projectId === activeWorkspaceId) ?? mounts[0] ?? null;
  const options: ReadonlyArray<SegmentedTabOption<ProjectId>> = mounts.map((mount) => ({
    value: mount.projectId,
    label: mount.mountName,
  }));

  return (
    <div className="flex min-w-0 items-center gap-2">
      {mounts.length > 1 && activeMount != null && (
        <SegmentedTabs
          options={options}
          value={activeMount.projectId}
          onChange={(projectId) => void setSessionActiveProject({ sessionId, projectId })}
          size="sm"
          ariaLabel="Active project"
        />
      )}
      <AddProjectChip sessionId={sessionId} />
    </div>
  );
};
