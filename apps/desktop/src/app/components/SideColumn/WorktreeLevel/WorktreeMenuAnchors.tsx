import { AnchoredPopover, useDropdown } from '@goodboy/ui';
import type { SessionId, SessionProjectMount } from '@goodboy/types';
import {
  MOUNT_SWITCH_BRANCH_EVENT,
  mountEventName,
} from '../../../../features/actions/kinds/mount';
import { BranchSwitchPanel } from '../../../../features/worktree/BranchSwitchPanel';
import { PutOnBranchPopover } from '../../../../features/session/components/TaskPlacement/PutOnBranchPopover';

type Props = {
  readonly sessionId: SessionId;
  readonly mount: SessionProjectMount;
};

const ANCHOR = <span aria-hidden className="block h-0 w-px" />;

export const WorktreeMenuAnchors = ({ sessionId, mount }: Props) => {
  const switcher = useDropdown({
    width: 'w-96',
    expectedHeight: 400,
    openEvent: mountEventName({ name: MOUNT_SWITCH_BRANCH_EVENT, mountId: mount.mountId }),
  });
  return (
    <div data-worktree-anchors="" className="flex h-0 min-w-0 items-start px-2">
      <AnchoredPopover
        dropdown={switcher}
        role="dialog"
        ariaLabel="Switch branch"
        anchorClassName="flex shrink-0"
        trigger={ANCHOR}
      >
        <BranchSwitchPanel sessionId={sessionId} mountId={mount.mountId} onDone={switcher.close} />
      </AnchoredPopover>
      {mount.branch === '' || !mount.isAttached ? null : (
        <PutOnBranchPopover
          sessionId={sessionId}
          mountId={mount.mountId}
          projectId={mount.projectId}
          branch={mount.branch}
          anchor={ANCHOR}
        />
      )}
    </div>
  );
};
