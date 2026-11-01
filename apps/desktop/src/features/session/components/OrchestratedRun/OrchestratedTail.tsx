import { useState } from 'react';
import { Disclosure, Markdown } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isStoppedByRestart } from '../../../../store/slices/turn/isStoppedByRestart';
import { useQuietStep } from '../../../workflows/hooks/useQuietStep';
import { TailLine } from '../../../live-state/TailLine';
import { decisionEntries } from '../../../workflows/decisionEntries';
import { orchestratedTailOf } from '../../../workflows/orchestratedTailOf';
import { runQuestionsActionOf } from '../../../workflows/runQuestionsActionOf';
import { runQuestionsPlacementOf } from '../../../workflows/runQuestionsPlacement';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import type { RunView } from '../AgentTree/useRunView';
import { RunOpenQuestion } from '../RunOpenQuestion';
import { RunPrimaryAction } from '../AgentTree/RunHeader/RunPrimaryAction';
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

const MINUTE_MS = 60_000;

export const OrchestratedTail = ({ session, view }: Props) => {
  const { run, workflow, agents } = view;
  const readingIds = useAppStore((state) => state.orchestratorReadingHints[run.id] ?? NO_READING);
  const queuedCount = (run.orchestratorHints ?? []).filter(
    (hint) => hint.consumedAt == null && !readingIds.includes(hint.id),
  ).length;
  const quiet = useQuietStep({ agents });
  const mountBlock = useMountBlockedStep({ sessionId: session.id, workflowRunId: run.id });
  const [isWhyOpen, setIsWhyOpen] = useState(false);
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
    restartStoppedCount: agents.filter((agent) => isStoppedByRestart({ agent, runs: agents }))
      .length,
    mountBlock,
  });
  if (tail === null) {
    return <RunPendingDelivery sessionId={session.id} />;
  }
  const tailVerbs = tail.verbs.filter((verb) => verb.kind !== 'primary');
  const isMountBlocked = mountBlock !== null && tail.blockedAgentId === mountBlock.agentId;
  const phase = view.orchestrator.state.phase;
  const entries = decisionEntries({ run, steps: workflow.steps });
  const latest = entries.decisions[0] ?? null;
  const blockedReason = phase === 'blocked' ? (entries.closing?.reason ?? '') : '';
  const isReasonShown =
    latest !== null &&
    phase !== 'done' &&
    phase !== 'failed' &&
    phase !== 'step-failed' &&
    phase !== 'blocked';

  const placement = runQuestionsPlacementOf({
    phase,
    questions: view.orchestrator.runQuestions,
  });
  const stopAction = runQuestionsActionOf({ stop: run.orchestrationStop, primary: view.primary });
  const questionCluster = (
    <RunOpenQuestion
      sessionId={session.id}
      questions={view.orchestrator.runQuestions}
      readOnlyAction={
        stopAction === null ? null : (
          <RunPrimaryAction
            session={session}
            view={view}
            primary={stopAction}
            variant="secondary"
          />
        )
      }
    />
  );

  return (
    <section
      aria-label="Run state"
      data-orchestrated-tail={view.orchestrator.state.phase}
      className="flex min-w-0 flex-col gap-1"
    >
      {placement === 'before-state' ? questionCluster : null}
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
            tailVerbs.length === 0
              ? null
              : tailVerbs.map((verb) => (
                  <OrchestratedTailVerb key={verb.kind} session={session} view={view} verb={verb} />
                ))
          }
        />
      )}
      {placement === 'after-state' ? questionCluster : null}
      <RunPendingDelivery sessionId={session.id} />
      {isMountBlocked ? (
        <OrchestratedMountBlock sessionId={session.id} block={mountBlock} />
      ) : tail.blockedAgentId === null ? null : (
        <OrchestratedBlockedStep sessionId={session.id} agentId={tail.blockedAgentId} />
      )}
      {blockedReason === '' ? null : (
        <div data-orchestrated-block="" className="min-w-0 px-2">
          <Markdown text={blockedReason} className="text-ui text-muted-foreground" />
        </div>
      )}
      {isReasonShown ? (
        <Disclosure
          label={
            <span className="text-ui text-muted-foreground">{ORCHESTRATED_COPY.whyThisStep}</span>
          }
          isOpen={isWhyOpen}
          onToggle={() => setIsWhyOpen((isOpen) => !isOpen)}
          className="self-start"
        >
          <div data-orchestrated-reason="" className="min-w-0">
            <Markdown text={latest.reason} className="text-ui text-muted-foreground" />
          </div>
        </Disclosure>
      ) : null}
    </section>
  );
};
