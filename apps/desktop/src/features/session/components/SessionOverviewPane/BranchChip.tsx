import { useEffect } from 'react';
import { Check, GitBranch, Pencil } from 'lucide-react';
import { AnchoredPopover, cn, Tooltip, useCopyLink, useDropdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useToast } from '../../../../app/components/Toast';
import { BranchSwitchPanel } from '../../../worktree/BranchSwitchPanel';

type Props = {
  readonly branch: string;
  readonly mountName?: string | null;
  readonly sessionId: SessionId;
  readonly canEdit: boolean;
};

export const BranchChip = ({ branch, mountName = null, sessionId, canEdit }: Props) => {
  const { showToast } = useToast();
  const { copied, failed, copy } = useCopyLink();
  const dropdown = useDropdown({
    disabled: !canEdit,
    width: 'w-96',
    expectedHeight: 360,
  });
  const { open, close, toggle } = dropdown;

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

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Switch branch"
      anchorClassName={cn(
        'group/branch inline-flex min-w-0 max-w-full shrink items-center rounded-md border font-mono text-2xs transition-colors',
        copied
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border-soft bg-muted/30 text-foreground/80 hover:border-border hover:bg-muted/50 hover:text-foreground',
      )}
      trigger={
        <>
          <Tooltip content={copied ? 'Copied' : 'Click to copy the branch name'}>
            <button
              type="button"
              onClick={() => void copy(branch)}
              aria-label={`Copy branch ${branch}`}
              className="inline-flex min-w-0 items-center gap-1.5 px-2 py-1"
            >
              {copied ? (
                <Check size={10} aria-hidden className="shrink-0" />
              ) : (
                <GitBranch
                  size={10}
                  aria-hidden
                  className="shrink-0 text-muted-foreground group-hover/branch:text-foreground"
                />
              )}
              {mountName != null ? (
                <span className="text-muted-foreground">{mountName}:</span>
              ) : null}
              <span className="truncate">{branch}</span>
            </button>
          </Tooltip>

          {canEdit ? (
            <Tooltip content="Edit branch" side="top">
              <button
                type="button"
                onClick={toggle}
                aria-label="Edit branch"
                aria-haspopup="dialog"
                aria-expanded={open}
                className={cn(
                  'inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/50',
                  'opacity-0 transition-[opacity,color,background-color] hover:bg-muted hover:text-foreground',
                  'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                  'group-hover/branch:opacity-100 motion-reduce:opacity-60',
                )}
              >
                <Pencil size={10} aria-hidden />
              </button>
            </Tooltip>
          ) : null}
        </>
      }
    >
      <BranchSwitchPanel sessionId={sessionId} onDone={close} />
    </AnchoredPopover>
  );
};
