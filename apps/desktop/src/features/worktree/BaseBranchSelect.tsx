import { AnchoredPopover, cn, useDropdown } from '@goodboy/ui';
import { ChevronDown } from 'lucide-react';
import { BaseBranchSelectContent } from './BaseBranchSelectContent';

type Props = {
  readonly repoPath: string;
  readonly value: string | null;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly onCommit: (next: string | null) => void | Promise<void>;
};

export const BaseBranchSelect = ({
  repoPath,
  value,
  placeholder = 'main',
  disabled = false,
  onCommit,
}: Props) => {
  const dropdown = useDropdown({ disabled, width: 'w-64', expectedHeight: 248 });
  const displayValue = value ?? placeholder;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      className="border-border-soft bg-subtle shadow-lg"
      trigger={
        <button
          type="button"
          disabled={disabled}
          aria-label={`Base branch: ${displayValue}`}
          aria-haspopup="listbox"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className={cn(
            'flex h-7 min-w-0 items-center gap-1 rounded-md border border-border-soft bg-background/70 px-2 font-mono text-xs text-foreground hover:border-border-strong hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
            value == null && 'text-muted-foreground',
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{displayValue}</span>
          <ChevronDown
            size={11}
            aria-hidden
            className={cn('shrink-0 transition-transform', dropdown.open && 'rotate-180')}
          />
        </button>
      }
    >
      <BaseBranchSelectContent
        repoPath={repoPath}
        value={value}
        onCommit={onCommit}
        onClose={dropdown.close}
      />
    </AnchoredPopover>
  );
};
