import { cn } from '@goodboy/ui';
import { Plus } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { SpawnAgentMenu } from './SpawnAgentMenu';

type SpawnAgentControlProps = {
  sessionId: SessionId;
  className?: string;
};

export function SpawnAgentControl({ sessionId, className }: SpawnAgentControlProps) {
  return (
    <div className={cn('relative mt-1', className)}>
      <SpawnAgentMenu
        sessionId={sessionId}
        trigger={({ ref, onClick, ...aria }) => (
          <button
            ref={ref}
            type="button"
            onClick={onClick}
            className="flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
            {...aria}
          >
            <Plus size={13} aria-hidden />
            Create agent
          </button>
        )}
      />
    </div>
  );
}
