import { Plus, X } from 'lucide-react';
import { cn, StatusDot, Tooltip, type Tone } from '@goodboy/ui';
import type {
  TerminalTab,
  TerminalTabId,
  TerminalTabStatus,
} from '../../../../shared/types/terminal';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly tabs: readonly TerminalTab[];
  readonly activeId: TerminalTabId | null;
  readonly onSelect: (id: TerminalTabId) => void;
  readonly onClose: (id: TerminalTabId) => void;
  readonly onSpawn: () => void;
};

const STATUS_TONE: Record<TerminalTabStatus, Tone> = {
  running: 'success',
  exited: 'neutral',
  attention: 'warning',
};

export const TerminalTabStrip = ({ tabs, activeId, onSelect, onClose, onSpawn }: Props) => {
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5">
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
            <StatusDot tone={STATUS_TONE[t.status]} size="md" />
            <span className="max-w-[10rem] truncate">{t.title}</span>
            <Tooltip content={`Close ${t.title}`}>
              <button
                type="button"
                aria-label={`Close ${t.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(t.id);
                }}
                className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              >
                <X size={11} aria-hidden />
              </button>
            </Tooltip>
          </div>
        );
      })}
      <Tooltip content="New terminal">
        <button
          type="button"
          aria-label="New terminal"
          onClick={onSpawn}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
};
