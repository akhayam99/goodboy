import { Button, Notice } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openStorage } from '../../openStorage';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceStorageNotice = ({ workspaceId }: Props) => {
  const orphans = useAppStore((state) => state.orphanWorktrees[workspaceId]?.length ?? 0);
  const retained = useAppStore((state) => state.retainedWorktreePaths[workspaceId]?.length ?? 0);
  const count = orphans + retained;
  if (count === 0) {
    return null;
  }
  const title =
    count === 1
      ? '1 session folder from this workspace is left on disk.'
      : `${count} session folders from this workspace are left on disk.`;
  return (
    <Notice
      tone="info"
      placement="inline"
      title={title}
      body="No session uses them any more."
      actions={
        <Button variant="secondary" size="sm" onClick={() => openStorage({ workspaceId })}>
          Review in Storage
        </Button>
      }
    />
  );
};
