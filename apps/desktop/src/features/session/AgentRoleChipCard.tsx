import { useMemo } from 'react';
import type { Agent, OpenQuestion } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { AgentKindChip } from '../../shared/components/AgentKindChip';
import { useSessionRoleModels } from '../../shared/hooks/useSessionRoleModels';
import { RoleCard } from '../workTreeModel/RoleCard';
import { resolveAgentRowState } from '../workTreeModel/rowState';
import type { AgentKind } from './agent-kind';
import { TimelineProviderGlyph } from './components/SessionWorkspace/parts/TimelinePane/TimelineProviderGlyph';
import { useAgentRowModels } from './components/SessionWorkspace/parts/TimelinePane/useAgentRowModels';
import { useAgentRowWork } from './hooks/useAgentRowWork';
import { attachedQuestionsFor } from './timeline/attachedQuestions';
import type { TimelineAgentEntry } from './timeline/buildTimelineGroups';

type Props = {
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly position: string;
  readonly costUsd: number;
  readonly isOpen: boolean;
  readonly onClick?: () => void;
};

type EntryParams = {
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
};

const NO_QUESTIONS: ReadonlyArray<OpenQuestion> = [];

const roleEntryOf = ({ agent, kind, openQuestions }: EntryParams): TimelineAgentEntry => ({
  kind: 'agent',
  id: `agent:${agent.id}`,
  at: agent.startedAt ?? null,
  ordinal: agent.ordinal,
  agent,
  agentKind: kind,
  isMissingArtifact: false,
  stepLabel: null,
  openQuestions,
  terminalQuestions: NO_QUESTIONS,
  children: [],
  answers: [],
  hasDuration: agent.startedAt != null && agent.completedAt != null,
  chain: null,
});

export const AgentRoleChipCard = ({ agent, kind, position, costUsd, isOpen, onClick }: Props) => {
  const { sessionId } = agent;
  const questions = useAppStore((state) => state.sessionOpenQuestions[sessionId] ?? NO_QUESTIONS);
  const roleModels = useSessionRoleModels({ sessionId });
  const sessionProvider = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.providerPreference.defaultProvider ?? null,
  );
  const sessionEffort = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.effort ?? null,
  );
  const entry = useMemo(
    () =>
      roleEntryOf({
        agent,
        kind,
        openQuestions: attachedQuestionsFor({ questions, agent }).filter(
          (question) => question.status === 'open',
        ),
      }),
    [agent, kind, questions],
  );
  const rowState = resolveAgentRowState({
    agent,
    isAsking: entry.openQuestions.length > 0,
    question: entry.openQuestions[0] ?? null,
    isReadyStep: false,
  });
  const work = useAgentRowWork({
    agent,
    kind,
    step: null,
    roleModels,
    sessionProvider,
    sessionEffort,
    phase: rowState.phase,
  });
  const { models, kindWord } = useAgentRowModels({ entry, work, phase: rowState.phase });
  return (
    <RoleCard
      entry={entry}
      position={position}
      kindWord={kindWord}
      models={models}
      routing={work.routing}
      time={work.time}
      rowState={rowState}
      costUsd={costUsd}
      markOf={({ provider }) => <TimelineProviderGlyph provider={provider} />}
      isOpen={isOpen}
    >
      <span
        data-testid="role-glyph"
        role="img"
        aria-label={kindWord}
        className="pointer-events-auto inline-flex shrink-0 self-center"
        onClick={onClick}
      >
        <AgentKindChip kind={kind} density="glyph" isDecorative />
      </span>
    </RoleCard>
  );
};
