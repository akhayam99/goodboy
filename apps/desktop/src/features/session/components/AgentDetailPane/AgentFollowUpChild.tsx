import { useMemo } from 'react';
import { StatusDot, cn } from '@goodboy/ui';
import type { AgentStatus, SessionId } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions, agentPlace } from '../../../../store';
import { useTranscript } from '../../../../store/slices/transcripts/selectors';
import { attachedQuestionsFor } from '../../timeline/attachedQuestions';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { AgentStatusIcon } from '../AgentCard/AgentStatusIcon';
import { agentStatusWord } from '../../agentStatusWord';
import { agentNowState } from './agentNowState';
import { openAgentRevealEvent } from './agentOpenTab';
import type { FollowUpChild } from './followUpChildren';

type Props = {
  readonly entry: FollowUpChild;
  readonly sessionId: SessionId;
};

const TERMINAL_STATUSES: ReadonlyArray<AgentStatus> = ['completed', 'failed', 'skipped', 'stopped'];

export const AgentFollowUpChild = ({ entry, sessionId }: Props) => {
  const { child, kind } = entry;
  const agent = child.agent;
  const navigate = useAppStore((state) => state.navigate);
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const transcript = useTranscript(agent.id);
  const questions = useSessionOpenQuestions(sessionId);
  const hasQuestion = useMemo(
    () => attachedQuestionsFor({ questions, agent }).some((question) => question.status === 'open'),
    [agent, questions],
  );

  const terminalLabel = TERMINAL_STATUSES.includes(child.status)
    ? agentStatusWord({ status: child.status })
    : null;
  const live = agentNowState({ agent, turnState, transcript });
  const label = hasQuestion
    ? 'question'
    : (terminalLabel ?? live.label ?? agentStatusWord({ status: child.status }));

  const onOpen = () => {
    navigate({ to: agentPlace({ sessionId, agentId: agent.id }) });
    window.dispatchEvent(openAgentRevealEvent());
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-border-soft bg-elevated px-3 py-2 text-label">
      <AgentKindChip kind={kind} />
      <span className="min-w-0 flex-1 truncate text-foreground">{agent.name}</span>
      {hasQuestion ? (
        <StatusDot tone="warning" size="sm" />
      ) : (
        <AgentStatusIcon status={child.status} />
      )}
      <span className="max-w-28 shrink-0 truncate text-meta text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'shrink-0 rounded-sm px-2 py-0.5 text-chip text-muted-foreground',
          'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        )}
      >
        Go to chat
      </button>
    </div>
  );
};
