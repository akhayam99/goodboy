import { Markdown } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { isStoppedByRestart } from '../../../../store/slices/turn/isStoppedByRestart';
import { useQuietStep } from '../../../workflows/hooks/useQuietStep';
import { TailLine } from '../../../live-state/TailLine';
import { decisionEntries } from '../../../workflows/decisionEntries';
import { hintQueueOf } from '../../../workflows/hintQueueOf';
import { isBetweenStepsPhase } from '../../../workflows/isBetweenStepsPhase';
import { orchestratedTailOf } from '../../../workflows/orchestratedTailOf';
import { runQuestionsPlacementOf } from '../../../workflows/runQuestionsPlacement';
import type { RunView } from '../AgentTree/useRunView';
import { RunOpenQuestion } from '../RunOpenQuestion';
import { RunPendingDelivery } from '../RunPendingDelivery';
import { useMountBlockedStep } from '../../hooks/useMountBlockedStep';
import { OrchestratedBlockedStep } from './OrchestratedBlockedStep';
import { OrchestratedMountBlock } from './OrchestratedMountBlock';
import { OrchestratedTailVerb } from './OrchestratedTailVerb';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

const NO_READING: ReadonlyArray<string> = [];

const NO_VIEWS: ReadonlyArray<AutoTreeView> = [];

const MINUTE_MS = 60_000;

export const OrchestratedTail = ({ session, view }: Props) => {
  const { run, workflow, agents } = view;
  const readingIds = useAppStore((state) => state.orchestratorReadingHints[run.id] ?? NO_READING);
  const { queuedCount } = hintQueueOf({ run, readingIds });
  const autoTreeViews = useAppStore((state) => state.autoTreeViews[session.id] ?? NO_VIEWS);
  const quiet = useQuietStep({ agents });
  const mountBlock = useMountBlockedStep({ sessionId: session.id, workflowRunId: run.id });
  const tail = orchestratedTailOf({
    orchestrator: view.orchestrator.state,
    agents,
    primary: view.primary,
    queuedCount,
    isDiscarded: view.isDiscarded,
    quiet:
      quiet === null
        ? null
        : { agentId: quiet.agent.id, minutes: Math.floor(quiet.quietMs / MINUTE_MS) },
    restartStoppedCount: agents.filter((agent) =>
      isStoppedByRestart({ agent, runs: agents, views: autoTreeViews }),
    ).length,
    mountBlock,
  });
  if (tail === null) {
    return <RunPendingDelivery sessionId={session.id} />;
  }
  const tailVerbs = tail.verbs.filter((verb) => verb.kind !== 'primary');
  if (view.orchestrator.state.phase === 'done' && tailVerbs.length === 0) {
    return <RunPendingDelivery sessionId={session.id} />;
  }
  const isMountBlocked = mountBlock !== null && tail.blockedAgentId === mountBlock.agentId;
  const phase = view.orchestrator.state.phase;
  const entries = decisionEntries({ run, steps: workflow.steps });
  const blockedReason = phase === 'blocked' ? (entries.closing?.reason ?? '') : '';

  const placement = runQuestionsPlacementOf({
    phase,
    stop: run.orchestrationStop,
    questions: view.orchestrator.runQuestions,
  });
  const questionCluster = (
    <RunOpenQuestion sessionId={session.id} questions={view.orchestrator.runQuestions} />
  );

  return (
    <section
      aria-label="Run state"
      data-orchestrated-tail={view.orchestrator.state.phase}
      className="flex min-w-0 flex-col gap-4"
    >
      {placement === 'before-state' ? questionCluster : null}
      <div className="flex min-w-0 flex-col gap-1">
        {isMountBlocked || isBetweenStepsPhase({ phase }) ? null : (
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
              tailVerbs.length === 0
                ? null
                : tailVerbs.map((verb) => (
                    <OrchestratedTailVerb
                      key={verb.kind}
                      session={session}
                      view={view}
                      verb={verb}
                    />
                  ))
            }
          />
        )}
        <RunPendingDelivery sessionId={session.id} />
        {isMountBlocked ? (
          <OrchestratedMountBlock sessionId={session.id} block={mountBlock} />
        ) : tail.blockedAgentId === null ? null : (
          <OrchestratedBlockedStep
            sessionId={session.id}
            agentId={tail.blockedAgentId}
            isReasonShown={false}
          />
        )}
        {blockedReason === '' ? null : (
          <div data-orchestrated-block="" className="min-w-0 px-2">
            <Markdown text={blockedReason} className="text-ui text-muted-foreground" />
          </div>
        )}
      </div>
      {placement === 'after-state' ? questionCluster : null}
    </section>
  );
};
