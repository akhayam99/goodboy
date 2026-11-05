import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, ICON_SIZE, cn, formatUsd, tintClasses } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { autoGlanceOf } from '../../../auto/glance/autoGlanceOf';

type Props = {
  readonly agent: Agent;
  readonly view: AutoTreeView;
  readonly settings: ReactNode;
};

export const AutoGlanceLine = ({ agent, view, settings }: Props) => {
  const rootTurn = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const [isOpen, setIsOpen] = useState(false);
  const glance = autoGlanceOf({ view, rootTurn });
  const tint = tintClasses(glance.tone);
  const budget = view.budget;
  const spend =
    budget === null
      ? null
      : budget.capUsd === null
        ? formatUsd(budget.spentUsd)
        : `${formatUsd(budget.spentUsd)} of ${formatUsd(budget.capUsd)}`;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        data-glance={glance.state}
        role="status"
        aria-live="polite"
        className="flex min-h-6 min-w-0 items-center gap-2 text-meta"
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-1.5 shrink-0 rounded-full',
            tint.dot,
            glance.isLive && 'motion-safe:animate-soft-pulse',
          )}
        />
        <span className={cn('shrink-0 text-row', tint.text)}>{glance.word}</span>
        <span aria-hidden="true" className="text-faint-foreground">
          ·
        </span>
        <span className="min-w-0 truncate text-muted-foreground">{glance.sentence}</span>
        <span className="flex-1" />
        {spend === null ? null : <span className="shrink-0 text-faint-foreground">{spend}</span>}
        <Button
          variant="quiet"
          size="xs"
          aria-expanded={isOpen}
          aria-controls={`auto-settings-${agent.id}`}
          onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        >
          Settings
          <ChevronDown size={ICON_SIZE.row} aria-hidden className={cn(isOpen && 'rotate-180')} />
        </Button>
      </div>
      <div
        id={`auto-settings-${agent.id}`}
        data-open={isOpen}
        className={cn(
          'min-w-0 flex-wrap items-center gap-2 rounded-lg bg-subtle px-3 py-2',
          isOpen ? 'flex' : 'hidden',
        )}
      >
        {settings}
      </div>
    </div>
  );
};
