import { FolderTree } from 'lucide-react';
import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { SessionId, SessionMount, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { OverflowMenu, type OverflowMenuItem } from '../../../../shared/components/OverflowMenu';
import type { Density } from '../../density';

const EMPTY_MOUNTS: ReadonlyArray<SessionMount> = [];
const COMPACT_TRIGGER_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

type Props = {
  readonly sessionId: SessionId;
  readonly density?: Density;
};

export const ProjectSwitcher = ({ sessionId, density = 'full' }: Props) => {
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

  if (density === 'compact') {
    const items: ReadonlyArray<OverflowMenuItem> = mounts.map((mount) => ({
      kind: 'item',
      key: mount.workspaceId,
      label: mount.mountName,
      onClick: () => void setSessionActiveMount({ sessionId, workspaceId: mount.workspaceId }),
      disabled: mount.workspaceId === activeMount.workspaceId,
    }));
    return (
      <OverflowMenu
        items={items}
        label="Active project"
        align="left"
        side="top"
        triggerClassName={COMPACT_TRIGGER_BUTTON}
        trigger={
          <>
            <FolderTree size={13} aria-hidden />
            <span className="density-trigger-label" data-density={density}>
              {activeMount.mountName}
            </span>
          </>
        }
      />
    );
  }

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
