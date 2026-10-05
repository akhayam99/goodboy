import { useEffect } from 'react';
import { GitBranch } from 'lucide-react';
import { AnchoredPopover, Chip, FOCUS_RING, Tooltip, cn, useDropdown } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { MOUNT_SWITCH_BRANCH_EVENT, mountEventName } from '../../../../actions/kinds/mount';
import { BranchSwitchPanel } from '../../../../worktree/BranchSwitchPanel';
import { splitBranchLabel } from './branchLabel';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly branch: string;
  readonly canSwitch: boolean;
  readonly blockedReason: string | null;
};

const CHIP_CLASS = 'min-w-0 max-w-full shrink-0 gap-0 px-0';
const FACE_CLASS = cn('inline-flex h-full min-w-0 items-center gap-2 rounded-md px-2', FOCUS_RING);

type NameParams = {
  readonly branch: string;
};

const BranchName = ({ branch }: NameParams) => {
  const { head, tail } = splitBranchLabel({ branch });
  return (
    <span title={branch} className="flex min-w-0 items-center font-mono">
      <span className="truncate">{head}</span>
      {tail === '' ? null : <span className="shrink-0">{tail}</span>}
    </span>
  );
};

export const ProjectBranchChip = ({
  sessionId,
  mountId,
  branch,
  canSwitch,
  blockedReason,
}: Props) => {
  const dropdown = useDropdown({ width: 'w-96', expectedHeight: 400 });
  const { open: isOpen, toggle } = dropdown;
  const isSwitchable = canSwitch && blockedReason === null;

  useEffect(() => {
    if (!isSwitchable) {
      return;
    }
    const name = mountEventName({ name: MOUNT_SWITCH_BRANCH_EVENT, mountId });
    const onOpen = () => {
      if (!isOpen) {
        toggle();
      }
    };
    window.addEventListener(name, onOpen);
    return () => window.removeEventListener(name, onOpen);
  }, [isOpen, isSwitchable, mountId, toggle]);

  if (branch === '') {
    return null;
  }

  if (!isSwitchable) {
    return (
      <Chip
        as="span"
        tone="neutral"
        shape="badge"
        size="control"
        className={CHIP_CLASS}
        label={
          <Tooltip content={blockedReason ?? branch}>
            <span className={FACE_CLASS}>
              <GitBranch size={11} aria-hidden />
              <BranchName branch={branch} />
            </span>
          </Tooltip>
        }
      />
    );
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Switch branch"
      anchorClassName="flex min-w-0 max-w-full shrink-0"
      trigger={
        <Chip
          as="span"
          tone="neutral"
          shape="badge"
          size="control"
          className={cn(CHIP_CLASS, 'hover:bg-hover hover:text-foreground')}
          label={
            <Tooltip content="Switch the branch of this worktree">
              <button
                type="button"
                aria-label={`Switch branch ${branch}`}
                aria-haspopup="dialog"
                aria-expanded={dropdown.open}
                onClick={dropdown.toggle}
                className={FACE_CLASS}
              >
                <GitBranch size={11} aria-hidden />
                <BranchName branch={branch} />
              </button>
            </Tooltip>
          }
        />
      }
    >
      <BranchSwitchPanel sessionId={sessionId} mountId={mountId} onDone={dropdown.close} />
    </AnchoredPopover>
  );
};
