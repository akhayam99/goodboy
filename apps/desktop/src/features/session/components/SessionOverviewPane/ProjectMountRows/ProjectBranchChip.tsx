import { Check, GitBranch } from 'lucide-react';
import {
  AnchoredPopover,
  Chip,
  FOCUS_RING,
  Tooltip,
  cn,
  useCopyLink,
  useDropdown,
} from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { BranchSwitchPanel } from '../../../../worktree/BranchSwitchPanel';
import { splitBranchLabel } from './branchLabel';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly branch: string;
  readonly canSwitch: boolean;
};

const CHIP_CLASS = 'min-w-0 shrink gap-0 px-0';
const FACE_CLASS = cn(
  'inline-flex h-full min-w-0 items-center gap-1.5 rounded-md px-2',
  FOCUS_RING,
);

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

type CopyChipParams = {
  readonly branch: string;
};

const CopyBranchChip = ({ branch }: CopyChipParams) => {
  const { copiedKey, failedKey, copy } = useCopyLink();
  const copied = copiedKey !== null;
  const failed = failedKey !== null;
  const tooltip = copied ? 'Copied' : failed ? 'Copy failed' : 'Copy branch name';

  return (
    <Chip
      as="span"
      tone={copied ? 'success' : failed ? 'danger' : 'neutral'}
      shape="badge"
      size="control"
      className={cn(CHIP_CLASS, copied || failed ? '' : 'hover:bg-hover hover:text-foreground')}
      label={
        <Tooltip content={tooltip}>
          <button
            type="button"
            onClick={() => void copy({ text: branch })}
            aria-label={`Copy branch ${branch}`}
            className={FACE_CLASS}
          >
            {copied ? <Check size={11} aria-hidden /> : <GitBranch size={11} aria-hidden />}
            <BranchName branch={branch} />
          </button>
        </Tooltip>
      }
    />
  );
};

export const ProjectBranchChip = ({ sessionId, mountId, branch, canSwitch }: Props) => {
  const dropdown = useDropdown({ width: 'w-96', expectedHeight: 400 });

  if (branch === '') {
    return null;
  }

  if (!canSwitch) {
    return <CopyBranchChip branch={branch} />;
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Switch branch"
      anchorClassName="flex min-w-0 shrink"
      trigger={
        <Chip
          as="span"
          tone="neutral"
          shape="badge"
          size="control"
          className={cn(CHIP_CLASS, 'hover:bg-hover hover:text-foreground')}
          label={
            <Tooltip content="Switch the branch of this mount">
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
