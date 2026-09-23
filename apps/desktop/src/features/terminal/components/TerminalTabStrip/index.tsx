import { Plus, X } from 'lucide-react';
import { cn, StatusDot, Tooltip, type Tone, tintClasses } from '@goodboy/ui';
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
                ? cn(
                    tintClasses('primary').bg,
                    'text-foreground ring-1',
                    tintClasses('primary').ring,
                  )
                : 'text-muted-foreground hover:bg-hover',
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
                className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
};
