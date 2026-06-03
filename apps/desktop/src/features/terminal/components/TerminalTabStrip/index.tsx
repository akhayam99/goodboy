import { Plus, X } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type {
  TerminalTab,
  TerminalTabId,
  TerminalTabStatus,
} from '../../../../shared/types/terminal';

interface Props {
  readonly tabs: readonly TerminalTab[];
  readonly activeId: TerminalTabId | null;
  readonly onSelect: (id: TerminalTabId) => void;
  readonly onClose: (id: TerminalTabId) => void;
  readonly onSpawn: () => void;
}

const STATUS_DOT: Record<TerminalTabStatus, string> = {
  running: 'bg-success',
  exited: 'bg-muted-foreground/40',
  attention: 'bg-warning',
};

export function TerminalTabStrip({ tabs, activeId, onSelect, onClose, onSpawn }: Props) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-1">
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <div
            key={t.id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onClick={() => onSelect(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(t.id);
              }
            }}
            className={cn(
              'group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs motion-safe:transition-colors',
              active
                ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                : 'text-muted-foreground hover:bg-muted/50',
            )}
          >
            <span
              className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[t.status])}
              aria-hidden
            />
            <span className="max-w-[10rem] truncate">{t.title}</span>
            <button
              type="button"
              aria-label={`close ${t.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.id);
              }}
              className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            >
              <X size={11} aria-hidden />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        aria-label="new terminal"
        onClick={onSpawn}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
      >
        <Plus size={13} aria-hidden />
      </button>
    </div>
  );
}
