import { useMemo } from 'react';
import { Band } from '@goodboy/ui';
import type { Agent, AgentId, OpenQuestion, Session, Step } from '@goodboy/types';
import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import type { AgentKind } from '../../agent-kind';
import { useAppStore } from '../../../../store';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';
import { SubagentTree } from '../../../workflows/components/RunTree/SubagentTree';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly children: ReadonlyArray<SpawnedChild>;
};

export const AgentBriefChildren = ({ session, agent, kind, children }: Props) => {
  const selectAgent = useAppStore((state) => state.selectAgent);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const focusQuestion = useOpenQuestions((state) => state.focusQuestion);
  const roleModels = useSessionRoleModels({ sessionId: session.id });
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const childIds = useMemo(
    () => new Set<AgentId>(children.map((child) => child.agent.id)),
    [children],
  );
  const stepById = useMemo(() => {
    const steps = new Map<string, Step>();
    for (const { workflow } of attachedRuns) {
      for (const step of workflow.steps) {
        steps.set(step.id, step);
      }
    }
    return steps;
  }, [attachedRuns]);
  if (children.length === 0 || kind === 'planner') {
    return null;
  }
  const done = children.filter((child) => child.status === 'completed').length;
  const onSelect = (agentId: AgentId) => {
    void selectAgent(session.id, agentId);
  };
  const onAnswer = (question: OpenQuestion | null) => {
    if (question != null) {
      focusQuestion(question.id);
    }
    setActiveLens(session.id, 'questions');
  };
  return (
    <Band
      inset="content"
      label="Subagents"
      action={
        <span className="text-secondary tabular-nums text-muted-foreground">
          {`${done} of ${children.length} done`}
        </span>
      }
    >
      <SubagentTree
        session={session}
        rootAgentId={agent.id}
        childIds={childIds}
        routing={{
          stepById,
          roleModels,
          sessionProvider: session.providerPreference?.defaultProvider ?? null,
          sessionEffort: session.effort ?? null,
        }}
        onSelect={onSelect}
        onAnswer={onAnswer}
      />
    </Band>
  );
};
