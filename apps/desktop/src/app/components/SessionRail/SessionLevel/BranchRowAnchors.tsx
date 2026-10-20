import { AnchoredPopover, useDropdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import {
  MOUNT_SWITCH_BRANCH_EVENT,
  mountEventName,
} from '../../../../features/actions/kinds/mount';
import { BranchSwitchPanel } from '../../../../features/worktree/BranchSwitchPanel';
import { PutOnBranchPopover } from '../../../../features/session/components/TaskPlacement/PutOnBranchPopover';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
};

const ANCHOR = <span aria-hidden className="block h-0 w-px" />;

export const BranchRowAnchors = ({ sessionId, row }: Props) => {
  const switcher = useDropdown({
    width: 'w-96',
    expectedHeight: 400,
    openEvent: mountEventName({ name: MOUNT_SWITCH_BRANCH_EVENT, mountId: row.mountId }),
  });
  return (
    <div data-worktree-anchors="" className="flex h-0 min-w-0 items-start pl-5">
      <AnchoredPopover
        dropdown={switcher}
        role="dialog"
        ariaLabel="Switch branch"
        anchorClassName="flex shrink-0"
        trigger={ANCHOR}
      >
        <BranchSwitchPanel sessionId={sessionId} mountId={row.mountId} onDone={switcher.close} />
      </AnchoredPopover>
      {row.branch === '' || !row.isAttached ? null : (
        <PutOnBranchPopover
          sessionId={sessionId}
          mountId={row.mountId}
          projectId={row.projectId}
          branch={row.branch}
          anchor={ANCHOR}
        />
      )}
    </div>
  );
};
