import { useState } from 'react';
import { Check, GitBranch, Pencil } from 'lucide-react';
import { cn, Popover } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { useDropdown } from '../../../../shared/hooks/useDropdown';
import { useToast } from '../../../../app/components/Toast';
import { BranchSwitchPanel } from '../../../worktree/BranchSwitchPanel';

type Props = {
  readonly branch: string;
  readonly sessionId: SessionId;
  readonly canEdit: boolean;
};

export const BranchChip = ({ branch, sessionId, canEdit }: Props) => {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const { open, close, toggle, containerRef, popupClassName } = useDropdown({
    disabled: !canEdit,
    width: 'w-96',
    expectedHeight: 360,
  });

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(branch);
      setCopied(true);
      showToast('success', 'branch copied');
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      showToast('error', `copy failed: ${formatError(err)}`);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'group/branch relative inline-flex min-w-0 max-w-full shrink items-center rounded-md border font-mono text-2xs transition-colors',
        copied
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border-soft bg-muted/30 text-foreground/80 hover:border-border hover:bg-muted/50 hover:text-foreground',
      )}
    >
      <button
        type="button"
        onClick={() => void onCopy()}
        title="Click to copy branch name"
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
        <span className="truncate">{branch}</span>
      </button>

      {canEdit ? (
        <button
          type="button"
          onClick={toggle}
          aria-label="Edit branch"
          title="Edit branch"
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
      ) : null}

      {open ? (
        <Popover
          role="dialog"
          ariaLabel="Switch branch"
          className={cn(popupClassName, 'overflow-visible bg-elevated')}
        >
          <BranchSwitchPanel sessionId={sessionId} onDone={close} />
        </Popover>
      ) : null}
    </div>
  );
};
