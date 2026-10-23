import { useState } from 'react';
import { Disclosure } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isStoppedByRestart } from '../../../../store/slices/turn/isStoppedByRestart';
import { useQuietStep } from '../../../workflows/hooks/useQuietStep';
import { TailLine } from '../../../live-state/TailLine';
import { decisionEntries } from '../../../workflows/decisionEntries';
import { orchestratedTailOf } from '../../../workflows/orchestratedTailOf';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import type { RunView } from '../AgentTree/useRunView';
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
  });
  if (tail === null) {
    return null;
  }
  const tailVerbs = tail.verbs.filter((verb) => verb.kind !== 'primary');
  const phase = view.orchestrator.state.phase;
  const latest = decisionEntries({ run, steps: workflow.steps }).decisions[0] ?? null;
  const isReasonShown =
    latest !== null && phase !== 'done' && phase !== 'failed' && phase !== 'step-failed';

  return (
    <section
      aria-label="Run state"
      data-orchestrated-tail={view.orchestrator.state.phase}
      className="flex min-w-0 flex-col"
    >
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
      {isReasonShown ? (
        <Disclosure
          label={
            <span className="text-ui text-muted-foreground">{ORCHESTRATED_COPY.whyThisStep}</span>
          }
          isOpen={isWhyOpen}
          onToggle={() => setIsWhyOpen((isOpen) => !isOpen)}
          className="self-start"
        >
          <p data-orchestrated-reason="" className="min-w-0 text-ui text-muted-foreground">
            {latest.reason}
          </p>
        </Disclosure>
      ) : null}
    </section>
  );
};
