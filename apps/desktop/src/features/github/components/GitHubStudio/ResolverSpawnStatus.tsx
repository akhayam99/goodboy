import type { AgentId, SessionId } from '@goodboy/types';
import { ArrowUpRight, Check } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import { GhostActionButton } from '../../../../shared/components/GhostActionButton';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly spawnedIds: ReadonlyArray<AgentId>;
  readonly onView: () => void;
};

export const ResolverSpawnStatus = ({ sessionId, spawnedIds, onView }: Props) => {
  const creations = useAppStore((state) => state.sessionCreations[sessionId]);
  const creating = (creations ?? []).filter((entry) => entry.kind === 'agent').length;

  if (creating === 0 && spawnedIds.length === 0) {
    return null;
  }

  const message =
    creating > 0
      ? creating === 1
        ? 'Creating resolver'
        : `Creating ${creating} resolvers`
      : spawnedIds.length === 1
        ? 'Resolver created'
        : `${spawnedIds.length} resolvers created`;

  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-border-soft bg-subtle px-2.5 py-1.5"
    >
      {creating > 0 ? (
        <StatusDot tone="primary" size="sm" pulsing />
      ) : (
        <Check size={13} aria-hidden className="text-success" />
      )}
      <p className="text-xs text-muted-foreground">{message}</p>
      <div className="ml-auto">
        <GhostActionButton
          icon={ArrowUpRight}
          label={spawnedIds.length > 1 ? 'View session' : 'View resolver'}
          disabled={spawnedIds.length === 0}
          title="Leave this pull request and go to the resolvers"
          onClick={onView}
        />
      </div>
    </div>
  );
};
