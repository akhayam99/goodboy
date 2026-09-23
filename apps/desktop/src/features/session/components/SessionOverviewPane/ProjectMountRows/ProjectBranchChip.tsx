import { Check, GitBranch, Pencil } from 'lucide-react';
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

export const ProjectBranchChip = ({ sessionId, mountId, branch, canSwitch }: Props) => {
  const { copiedKey, failedKey, copy } = useCopyLink();
  const dropdown = useDropdown({ width: 'w-96', expectedHeight: 360 });
  const copied = copiedKey !== null;
  const failed = failedKey !== null;

  if (branch === '') {
    return null;
  }

  const { head, tail } = splitBranchLabel({ branch });

  return (
    <Chip
      as="span"
      tone={copied ? 'success' : failed ? 'danger' : 'neutral'}
      shape="badge"
      size="control"
      className={cn(
        'min-w-0 shrink gap-0 px-0',
        copied || failed ? '' : 'hover:bg-hover hover:text-foreground',
      )}
      label={
        <Tooltip content={copied ? 'Copied' : failed ? 'Copy failed' : 'Copy the branch name'}>
          <button
            type="button"
            onClick={() => void copy({ text: branch })}
            aria-label={`Copy branch ${branch}`}
            className={cn(
              'inline-flex h-full min-w-0 items-center gap-1.5 rounded-md px-2',
              FOCUS_RING,
            )}
          >
            {copied ? <Check size={11} aria-hidden /> : <GitBranch size={11} aria-hidden />}
            <span title={branch} className="flex min-w-0 items-center font-mono">
              <span className="truncate">{head}</span>
              {tail === '' ? null : <span className="shrink-0">{tail}</span>}
            </span>
          </button>
        </Tooltip>
      }
      trailing={
        canSwitch ? (
          <AnchoredPopover
            dropdown={dropdown}
            role="dialog"
            ariaLabel="Switch branch"
            trigger={
              <Tooltip content="Switch the branch of this mount">
                <button
                  type="button"
                  aria-label="Switch branch"
                  aria-haspopup="dialog"
                  aria-expanded={dropdown.open}
                  onClick={dropdown.toggle}
                  className={cn(
                    'inline-flex h-full items-center rounded-md px-1.5 text-muted-foreground hover:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  <Pencil size={10} aria-hidden />
                </button>
              </Tooltip>
            }
          >
            <BranchSwitchPanel sessionId={sessionId} mountId={mountId} onDone={dropdown.close} />
          </AnchoredPopover>
        ) : null
      }
    />
  );
};
