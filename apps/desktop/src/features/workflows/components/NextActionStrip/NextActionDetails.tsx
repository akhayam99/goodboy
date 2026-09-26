import { useState } from 'react';
import type { AgentId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

type Props = {
  readonly agentId: AgentId;
};

export const NextActionDetails = ({ agentId }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const message = useAppStore((state) => {
    const turn = state.agentTurnState[agentId];
    return turn?.kind === 'error' ? turn.message : null;
  });
  if (message == null || message.trim() === '') {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          'w-fit rounded-sm text-secondary font-medium text-muted-foreground underline decoration-border-soft underline-offset-2',
          'transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        )}
      >
        {isOpen ? 'Hide details' : 'Show details'}
      </button>
      {isOpen && (
        <p
          data-testid="next-action-details"
          className="min-w-0 whitespace-pre-wrap break-words font-mono text-2xs leading-relaxed text-muted-foreground"
        >
          {message.trim()}
        </p>
      )}
    </div>
  );
};
