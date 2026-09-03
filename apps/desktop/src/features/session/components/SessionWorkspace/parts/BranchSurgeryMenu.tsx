import { MoreHorizontal } from 'lucide-react';
import type { BranchCommit } from '@goodboy/types';
import { AnchoredPopover, cn, Tooltip, useDropdown } from '@goodboy/ui';
import { BranchSurgery } from './BranchSurgery';

type Props = {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly headSha: string | null;
  readonly onAmend: (sha: string, message: string) => Promise<void>;
  readonly onSquash: (sha: string, message: string) => Promise<void>;
};

export const BranchSurgeryMenu = ({ commits, headSha, onAmend, onSquash }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedHeight: 360 });
  const { open: isOpen, toggle } = dropdown;

  if (commits.length === 0) {
    return null;
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Rewrite branch"
      className="py-1"
      trigger={
        <Tooltip content="Rewrite branch">
          <button
            type="button"
            onClick={toggle}
            aria-label="Rewrite branch"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            className={cn(
              'rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground',
              isOpen && 'bg-foreground/10 text-foreground',
            )}
          >
            <MoreHorizontal size={14} aria-hidden />
          </button>
        </Tooltip>
      }
    >
      <BranchSurgery commits={commits} headSha={headSha} onAmend={onAmend} onSquash={onSquash} />
    </AnchoredPopover>
  );
};
