import { useMemo } from 'react';
import type { AgentId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isStoppedByRestart } from '../../../../store/slices/turn/isStoppedByRestart';
import { TailLine } from '../../../live-state/TailLine';
import { askingAgentBatch } from '../../../context/askingAgentBatch';
import { useQuietStep } from '../../../workflows/hooks/useQuietStep';
import { useMountBlockedStep } from '../../hooks/useMountBlockedStep';
import { resolveNextAction } from '../../../workflows/resolveNextAction';
import { agentKindPalette, classifyAgent, resolveRootAgent } from '../../agent-kind';
import type { RunView } from '../AgentTree/useRunView';
import { OrchestratedBlockedStep } from '../OrchestratedRun/OrchestratedBlockedStep';
import { OrchestratedMountBlock } from '../OrchestratedRun/OrchestratedMountBlock';
import { runQuestionsPlacementOf } from '../../../workflows/runQuestionsPlacement';
import { RunOpenQuestion } from '../RunOpenQuestion';
import { RunPendingDelivery } from '../RunPendingDelivery';
import { RunTailVerb } from './RunTailVerb';
import { runTailOf } from './runTailOf';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly selectedAgentId: AgentId | null;
};

const MINUTE_MS = 60_000;

const HEADER_VERBS: ReadonlySet<string> = new Set(['primary', 'raiseCap', 'answer']);

export const RunTail = ({ session, view, selectedAgentId }: Props) => {
  const { run, workflow, advance } = view;
  const quiet = useQuietStep({ agents: advance.runAgents });
  const mountBlock = useMountBlockedStep({ sessionId: session.id, workflowRunId: run.id });
  const kindOverride = useAppStore((state) => state.agentKindOverride);
  const roleById = useMemo(
    () =>
      new Map(
        advance.runAgents.map((agent) => [
          agent.id,
          agentKindPalette({
            kind: classifyAgent({ agent, override: kindOverride[agent.id] ?? null }),
          }).label,
        ]),
      ),
    [advance.runAgents, kindOverride],
  );
  const selectedRootId =
    selectedAgentId === null
      ? null
      : (resolveRootAgent({ agents: advance.runAgents, agentId: selectedAgentId })?.id ?? null);
  const tail = runTailOf({
    run,
    workflow,
    agents: advance.runAgents,
    isCompleted: view.isCompleted,
    primary: view.primary,
    predecessorName: view.predecessorName,
    nextAction: resolveNextAction({
      advance: advance.state,
      run,
      workflow,
      agents: advance.runAgents,
      questions: advance.questions,
      subjectAgentId: null,
    }),
    quiet:
      quiet === null
        ? null
        : { agentId: quiet.agent.id, minutes: Math.floor(quiet.quietMs / MINUTE_MS) },
    selectedRootId,
    roleById,
    question: advance.questions[0] ?? null,
    restartStoppedCount: advance.runAgents.filter((agent) =>
      isStoppedByRestart({ agent, runs: advance.runAgents }),
    ).length,
  });
  if (tail === null) {
    return <RunPendingDelivery sessionId={session.id} />;
  }
  const selectedRoot =
    selectedRootId === null
      ? null
      : (advance.runAgents.find((agent) => agent.id === selectedRootId) ?? null);
  const isNotStarted =
    selectedRoot !== null &&
    selectedRoot.status === 'pending' &&
    run.orchestrationStop?.kind === 'budget';
  const blockedStep =
    tail.verb?.kind === 'recover'
      ? (advance.runAgents.find(
          (agent) => agent.parentAgentId == null && agent.status === 'blocked',
        ) ?? null)
      : null;
  const isMountBlocked = blockedStep !== null && mountBlock?.agentId === blockedStep.id;
  const stop = run.orchestrationStop;
  const isStopped = stop != null && stop.kind !== 'questions';
  const first =
    tail.verb?.kind === 'answer'
      ? tail.verb.question
      : isStopped
        ? (advance.questions[0] ?? null)
        : null;
  const clusterQuestions =
    first === null
      ? []
      : askingAgentBatch({
          questions: [
            first,
            ...advance.questions.filter(
              (question) =>
                question.id !== first.id &&
                (question.createdByAgentId ?? null) === (first.createdByAgentId ?? null),
            ),
          ],
        });
  const placement = runQuestionsPlacementOf({ phase: null, stop, questions: clusterQuestions });
  const questionCluster =
    clusterQuestions.length === 0 ? null : (
      <RunOpenQuestion sessionId={session.id} questions={clusterQuestions} />
    );
  return (
    <section
      aria-label="Run state"
      data-run-tail={tail.verb?.kind ?? 'none'}
      className="flex min-w-0 flex-col gap-2"
    >
      {placement === 'before-state' ? questionCluster : null}
      {isNotStarted ? (
        <p data-run-step-not-started="" className="text-ui text-muted-foreground">
          Not started, the run paused at the limit.
        </p>
      ) : null}
      {isMountBlocked ? null : (
        <TailLine
          facts={{
            state: tail.state,
            phrase: tail.phrase,
            startedAt: null,
            stepAgentId: tail.stepAgentId,
            actions: [],
          }}
          onAction={() => undefined}
          verbs={
            tail.verb === null || HEADER_VERBS.has(tail.verb.kind) ? null : (
              <RunTailVerb
                session={session}
                view={view}
                verb={tail.verb}
                isSecondary={blockedStep !== null}
              />
            )
          }
        />
      )}
      {placement === 'after-state' ? questionCluster : null}
      <RunPendingDelivery sessionId={session.id} />
      {blockedStep === null ? null : isMountBlocked && mountBlock !== null ? (
        <OrchestratedMountBlock sessionId={session.id} block={mountBlock} />
      ) : (
        <OrchestratedBlockedStep sessionId={session.id} agentId={blockedStep.id} />
      )}
    </section>
  );
};
