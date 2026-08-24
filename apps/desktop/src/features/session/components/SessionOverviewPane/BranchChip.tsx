import { useEffect } from 'react';
import { Check, GitBranch, Pencil } from 'lucide-react';
import { AnchoredPopover, Tooltip, cn, useCopyLink, useDropdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { useActiveMount } from '../../hooks/useActiveMount';
import { BranchSwitchPanel } from '../../../worktree/BranchSwitchPanel';
import { VITAL_CHIP_FOCUS, VITAL_CHIP_FRAME, VITAL_CHIP_HOVER } from './vitalChip';

type Props = {
  readonly sessionId: SessionId;
};

export const BranchChip = ({ sessionId }: Props) => {
  const { showToast } = useToast();
  const { copied, failed, copy } = useCopyLink();
  const activeMount = useActiveMount({ sessionId });
  const activeKind = useAppStore(
    (state) =>
      state.projects.find((project) => project.id === activeMount?.projectId)?.kind ?? null,
  );
  const branchDropdown = useDropdown({ width: 'w-96', expectedHeight: 360 });

  useEffect(() => {
    if (copied) {
      showToast('success', 'branch copied');
    }
  }, [copied, showToast]);

  useEffect(() => {
    if (failed) {
      showToast('error', 'copy failed');
    }
  }, [failed, showToast]);

  if (activeMount == null || activeMount.branch === '') {
    return null;
  }

  const branch = activeMount.branch;
  const canSwitch = activeKind === 'repo';

  return (
    <span
      className={cn(
        VITAL_CHIP_FRAME,
        'min-w-0 max-w-full shrink',
        copied ? 'border-success/30 bg-success/10 text-success' : VITAL_CHIP_HOVER,
      )}
    >
      <Tooltip content={copied ? 'Copied' : 'Copy the branch name'} side="top">
        <button
          type="button"
          onClick={() => void copy(branch)}
          aria-label={`Copy branch ${branch}`}
          className={cn(
            'inline-flex h-full min-w-0 items-center gap-1.5 rounded-md px-2',
            VITAL_CHIP_FOCUS,
          )}
        >
          {copied ? (
            <Check size={11} aria-hidden className="shrink-0" />
          ) : (
            <GitBranch size={11} aria-hidden className="shrink-0" />
          )}
          <span className="min-w-0 truncate font-mono">{branch}</span>
        </button>
      </Tooltip>
      {canSwitch ? (
        <AnchoredPopover
          dropdown={branchDropdown}
          role="dialog"
          ariaLabel="Switch branch"
          anchorClassName="flex h-full shrink-0"
          trigger={
            <Tooltip content="Switch branch" side="top">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={branchDropdown.open}
                aria-label="Switch branch"
                onClick={branchDropdown.toggle}
                className={cn(
                  'inline-flex shrink-0 items-center rounded-md px-1.5 text-muted-foreground hover:text-foreground',
                  VITAL_CHIP_FOCUS,
                )}
              >
                <Pencil size={10} aria-hidden />
              </button>
            </Tooltip>
          }
        >
          <BranchSwitchPanel sessionId={sessionId} onDone={branchDropdown.close} />
        </AnchoredPopover>
      ) : null}
    </span>
  );
};
