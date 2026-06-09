import { cn } from '@goodboy/ui';
import type { AgentStatus, ProviderRunId } from '@goodboy/types';

type Props = {
  parallelRunIds: ReadonlyArray<ProviderRunId>;
  runStatuses: Readonly<Record<ProviderRunId, AgentStatus>>;
  onSelectRun: (runId: ProviderRunId) => void;
};

const BADGE_CLASSES: Record<AgentStatus, string> = {
  running: 'bg-blue-500 motion-safe:animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-muted-foreground/40',
  pending: 'bg-muted-foreground/25',
};

export const ParallelProgressPill = ({ parallelRunIds, runStatuses, onSelectRun }: Props) => {
  if (parallelRunIds.length === 0) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-subtle px-2 py-0.5">
      {parallelRunIds.map((runId, i) => {
        const status: AgentStatus = runStatuses[runId] ?? 'pending';
        return (
          <button
            key={runId}
            type="button"
            aria-label={`run p${i + 1}: ${status}`}
            title={`run p${i + 1}: ${status}`}
            onClick={() => onSelectRun(runId)}
            className={cn(
              'inline-block h-2 w-2 rounded-full motion-safe:transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              BADGE_CLASSES[status],
            )}
          />
        );
      })}
    </div>
  );
};
