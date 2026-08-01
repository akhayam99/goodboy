import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { SessionId, SessionMount, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const EMPTY_MOUNTS: ReadonlyArray<SessionMount> = [];

type Props = {
  readonly sessionId: SessionId;
};

export const ProjectSwitcher = ({ sessionId }: Props) => {
  const mounts = useAppStore((state) => state.sessionMounts[sessionId] ?? EMPTY_MOUNTS);
  const activeWorkspaceId = useAppStore((state) => state.sessionActiveMount[sessionId] ?? null);
  const setSessionActiveMount = useAppStore((state) => state.setSessionActiveMount);

  if (mounts.length <= 1) {
    return null;
  }
  const activeMount =
    mounts.find((mount) => mount.workspaceId === activeWorkspaceId) ?? mounts[0] ?? null;
  if (activeMount == null) {
    return null;
  }
  const options: ReadonlyArray<SegmentedTabOption<WorkspaceId>> = mounts.map((mount) => ({
    value: mount.workspaceId,
    label: mount.mountName,
  }));

  return (
    <SegmentedTabs
      options={options}
      value={activeMount.workspaceId}
      onChange={(workspaceId) => void setSessionActiveMount({ sessionId, workspaceId })}
      size="sm"
      ariaLabel="Active project"
    />
  );
};
