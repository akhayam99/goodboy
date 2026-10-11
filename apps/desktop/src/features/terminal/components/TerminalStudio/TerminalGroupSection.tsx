import { ChevronRight } from 'lucide-react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TerminalGroup } from './terminalGroups';
import type { ReactNode } from 'react';

type Props = {
  readonly group: TerminalGroup;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
};

export const TerminalGroupSection = ({ group, isOpen, onToggle, children }: Props) => (
  <section aria-label={group.title} className="flex flex-col gap-1">
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1 rounded-md px-2 py-2 text-left text-label text-muted-foreground',
        ROW_INTERACTIVE,
      )}
    >
      <ChevronRight
        size={ICON_SIZE.row}
        aria-hidden
        className={cn('shrink-0 motion-safe:transition-transform', isOpen && 'rotate-90')}
      />
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="min-w-0 truncate text-foreground">{group.title}</span>
        {group.branch === null ? null : (
          <span className="min-w-0 truncate text-meta text-faint-foreground">{group.branch}</span>
        )}
      </span>
      <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
        {group.tabs.length}
      </span>
    </button>
    {isOpen ? <ul className="flex flex-col gap-0.5">{children}</ul> : null}
  </section>
);
