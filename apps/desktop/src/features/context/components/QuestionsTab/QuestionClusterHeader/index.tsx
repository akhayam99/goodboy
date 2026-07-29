import { Bot, ChevronRight } from 'lucide-react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { RoutingBadge } from '../../../../../shared/components/RoutingBadge';

type Props = {
  readonly sessionId: SessionId;
  readonly ownerAgent: Agent | null;
  readonly ownerAgentName: string | null;
  readonly creatorAgentName: string | null;
};

const openAgent = ({
  sessionId,
  agentId,
  select,
}: {
  sessionId: SessionId;
  agentId: AgentId | null;
  select: (sessionId: SessionId, agentId: AgentId) => Promise<void>;
}): void => {
  if (agentId == null) {
    return;
  }
  void select(sessionId, agentId);
};

export const QuestionClusterHeader = ({
  sessionId,
  ownerAgent,
  ownerAgentName,
  creatorAgentName,
}: Props) => {
  const selectAgent = useAppStore((s) => s.selectAgent);
  const label = ownerAgentName ?? 'unknown agent';
  const canOpen = ownerAgent != null;

  const inner = (
    <>
      <Bot size={12} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground/80">{label}</span>
      {ownerAgent != null && (
        <RoutingBadge
          provider={ownerAgent.providerOverride ?? null}
          model={ownerAgent.modelOverride ?? null}
          effort={ownerAgent.effort ?? null}
          missingLabel=""
        />
      )}
      {creatorAgentName !== null && (
        <span className="truncate text-muted-foreground">via {creatorAgentName}</span>
      )}
      {canOpen && (
        <ChevronRight size={11} aria-hidden className="ml-0.5 shrink-0 text-muted-foreground/60" />
      )}
    </>
  );

  if (canOpen) {
    return (
      <button
        type="button"
        onClick={() => openAgent({ sessionId, agentId: ownerAgent.id, select: selectAgent })}
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-md px-0.5 text-2xs font-medium',
          'hover:opacity-70 motion-safe:transition-opacity',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
        )}
        title={`open ${label}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 px-0.5 text-2xs font-medium">{inner}</div>
  );
};
