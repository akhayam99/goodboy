import { useMemo } from 'react';
import type { AgentId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isStoppedByRestart } from '../../../../store/slices/turn/isStoppedByRestart';
import { TailLine } from '../../../live-state/TailLine';
import { useQuietStep } from '../../../workflows/hooks/useQuietStep';
import { resolveNextAction } from '../../../workflows/resolveNextAction';
import { agentKindPalette, classifyAgent, resolveRootAgent } from '../../agent-kind';
import type { RunView } from '../AgentTree/useRunView';
import { RunTailVerb } from './RunTailVerb';
import { runTailOf } from './runTailOf';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly selectedAgentId: AgentId | null;
};

const MINUTE_MS = 60_000;

export const RunTail = ({ session, view, selectedAgentId }: Props) => {
  const { run, workflow, advance } = view;
  const quiet = useQuietStep({ agents: advance.runAgents });
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
    return null;
  }
  const selectedRoot =
    selectedRootId === null
      ? null
      : (advance.runAgents.find((agent) => agent.id === selectedRootId) ?? null);
  const isNotStarted =
    selectedRoot !== null &&
    selectedRoot.status === 'pending' &&
    run.orchestrationStop?.kind === 'budget';
  return (
    <section
      aria-label="Run state"
      data-run-tail={tail.verb?.kind ?? 'none'}
      className="flex min-w-0 flex-col gap-2"
    >
      {isNotStarted ? (
        <p data-run-step-not-started="" className="text-ui text-muted-foreground">
          Not started, the run paused at the limit.
        </p>
      ) : null}
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
          tail.verb === null ? null : <RunTailVerb session={session} view={view} verb={tail.verb} />
        }
      />
    </section>
  );
};
