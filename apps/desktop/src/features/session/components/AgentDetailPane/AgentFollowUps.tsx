import { ArrowRight } from 'lucide-react';
import { SectionSurface, cn } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useAgentStartedToast } from '../../../../shared/hooks/useAgentStartedToast';
import type { AgentKind } from '../../agent-kind';
import { AGENT_KIND_META } from '../../agent-kind';
import { agentFollowUpMoves, composeFollowUpSeed } from './followUpMoves';

type Props = {
  readonly sourceAgent: Agent;
  readonly sourceKind: AgentKind;
  readonly summary: string;
  readonly sessionId: SessionId;
};

export const AgentFollowUps = ({ sourceAgent, sourceKind, summary, sessionId }: Props) => {
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const announceAgentStarted = useAgentStartedToast();

  const moves = agentFollowUpMoves({ sourceKind });
  if (moves.length === 0) {
    return null;
  }
  if (sourceAgent.status !== 'completed') {
    return null;
  }
  if (sourceAgent.workflowRunId != null) {
    return null;
  }

  const onSpawn = (nextKind: AgentKind) => {
    const seed = composeFollowUpSeed({ sourceAgent, summary });
    void (async () => {
      const agentId = await spawnAgent(sessionId, {
        kindOverride: nextKind,
        initialPrompt: seed,
        focus: 'agent',
      });
      announceAgentStarted({
        sessionId,
        agentId,
        title: `${AGENT_KIND_META[nextKind].label} started`,
        message: `Picking up where ${sourceAgent.name} left off.`,
      });
    })();
  };

  return (
    <SectionSurface label="Continue" hint="Spawn a follow-up seeded with this agent's output.">
      <div className="flex flex-col gap-1.5">
        {moves.map((move) => (
          <button
            key={move.kind}
            type="button"
            onClick={() => onSpawn(move.kind)}
            className={cn(
              'group flex items-start gap-2 rounded-md border border-border-soft bg-elevated px-3 py-2 text-left text-xs transition-colors hover:border-border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
            )}
          >
            <ArrowRight
              size={12}
              aria-hidden
              className="mt-0.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium text-foreground">{move.label}</span>
              <span className="text-2xs text-muted-foreground">{move.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </SectionSurface>
  );
};
