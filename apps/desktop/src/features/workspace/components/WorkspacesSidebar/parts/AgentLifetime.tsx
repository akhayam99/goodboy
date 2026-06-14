import type { Agent } from '@goodboy/types';
import { formatRelativeDuration } from '../../../../../shared/utils/relativeDate';
import { useNow } from '../../../../../shared/hooks/useNow';

export function AgentLifetime({ run }: { run: Agent }) {
  const isLive = !!run.startedAt && !run.completedAt;
  const now = useNow(5_000, isLive);
  void now;

  if (!run.startedAt) {
    return (
      <span
        className="font-mono text-muted-foreground/60"
        title="agent spawned but has not run yet"
      >
        0
      </span>
    );
  }

  const ageStr = formatRelativeDuration(run.startedAt, run.completedAt);
  const tooltip = run.completedAt
    ? `started ${run.startedAt}\ncompleted ${run.completedAt}\nworked ${ageStr}`
    : `started ${run.startedAt}\nworking for ${ageStr}`;

  return (
    <span className="font-mono text-muted-foreground/80" title={tooltip}>
      {ageStr}
    </span>
  );
}
