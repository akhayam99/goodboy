import { BookOpen, SquareTerminal } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { PanelTab } from '../lib';

interface TabStripProps {
  readonly tab: PanelTab;
  readonly onPick: (next: PanelTab) => void;
  readonly summarizerRunning: boolean;
  readonly isTerminalOpen: boolean;
}

export function TabStrip({ tab, onPick, summarizerRunning, isTerminalOpen }: TabStripProps) {
  return (
    <div role="tablist" aria-label="context panel tabs" className="flex items-center gap-0.5">
      <TabButton
        active={tab === 'context'}
        onClick={() => onPick('context')}
        icon={<BookOpen size={11} aria-hidden />}
        label="Context"
        accentDot={summarizerRunning ? 'bg-info' : null}
      />
      <TabButton
        active={tab === 'terminal'}
        onClick={() => onPick('terminal')}
        icon={<SquareTerminal size={11} aria-hidden />}
        label="Terminal"
        accentDot={isTerminalOpen ? 'bg-info' : null}
      />
    </div>
  );
}

interface TabButtonProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly badge?: number | null;
  readonly accentDot?: string | null;
}

function TabButton({ active, onClick, icon, label, badge, accentDot }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-semibold uppercase leading-none tracking-[0.06em] transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      {icon}
      {active ? <span>{label}</span> : null}
      {badge !== null && badge !== undefined ? (
        <span className="ml-0.5 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-muted px-1 text-[9px] font-medium tracking-normal text-muted-foreground">
          {badge}
        </span>
      ) : null}
      {accentDot ? (
        <span aria-hidden className={cn('ml-0.5 size-1.5 rounded-full', accentDot)} />
      ) : null}
    </button>
  );
}
