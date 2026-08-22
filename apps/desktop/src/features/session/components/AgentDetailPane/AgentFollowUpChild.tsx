import { useMemo } from 'react';
import { StatusDot, cn } from '@goodboy/ui';
import type { AgentStatus, SessionId } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../store';
import { useTranscript } from '../../../../store/transcript';
import { attachedQuestionsFor } from '../../timeline/attachedQuestions';
import { AgentKindChip } from '../AgentKindChip';
import { AgentStatusIcon } from '../AgentCard/AgentStatusIcon';
import { agentNowState } from './agentNowState';
import type { FollowUpChild } from './followUpChildren';

type Props = {
  readonly entry: FollowUpChild;
  readonly sessionId: SessionId;
};

const TERMINAL_LABELS: Partial<Record<AgentStatus, string>> = {
  completed: 'done',
  failed: 'failed',
  skipped: 'skipped',
};

export const AgentFollowUpChild = ({ entry, sessionId }: Props) => {
  const { child, kind } = entry;
  const agent = child.agent;
  const selectAgent = useAppStore((state) => state.selectAgent);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const transcript = useTranscript(agent.id);
  const questions = useSessionOpenQuestions(sessionId);
  const hasQuestion = useMemo(
    () => attachedQuestionsFor({ questions, agent }).some((question) => question.status === 'open'),
    [agent, questions],
  );

  const terminalLabel = TERMINAL_LABELS[child.status] ?? null;
  const live = agentNowState({ agent, turnState, transcript });
  const label = hasQuestion ? 'question' : (terminalLabel ?? live.label);

  const onOpen = () => {
    void (async () => {
      await setCurrentSession(sessionId);
      setActiveLens(sessionId, 'agents');
      await selectAgent(sessionId, agent.id);
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    })();
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-border-soft bg-elevated px-3 py-2 text-xs">
      <AgentKindChip kind={kind} />
      <span className="min-w-0 flex-1 truncate text-foreground">{agent.name}</span>
      {hasQuestion ? (
        <StatusDot tone="warning" size="sm" />
      ) : (
        <AgentStatusIcon status={child.status} />
      )}
      <span className="max-w-28 shrink-0 truncate text-2xs text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium text-muted-foreground',
          'hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]',
        )}
      >
        Go to chat
      </button>
    </div>
  );
};
