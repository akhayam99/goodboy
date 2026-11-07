import { useState } from 'react';
import { Button, FOCUS_RING, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import type { OrchestratedVerb } from '../../../workflows/orchestratedTailOf';
import { RunPrimaryAction } from '../AgentTree/RunHeader/RunPrimaryAction';
import type { RunView } from '../AgentTree/useRunView';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly verb: OrchestratedVerb;
};

type PressParams = {
  readonly task: () => Promise<unknown>;
  readonly failure: string;
};

const QUIET_VERB = cn(
  'inline-flex h-6 items-center gap-1 rounded-md px-2 text-ui text-muted-foreground hover:bg-hover hover:text-foreground',
  FOCUS_RING,
);

export const OrchestratedTailVerb = ({ session, view, verb }: Props) => {
  const sessionId = session.id;
  const runId = view.run.id;
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const readQueuedWorkflowHints = useAppStore((state) => state.readQueuedWorkflowHints);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const askAgentToContinue = useAppStore((state) => state.askAgentToContinue);
  const resumeStoppedAgents = useAppStore((state) => state.resumeStoppedAgents);
  const reportError = useAppStore((state) => state.reportError);
  const [isBusy, setIsBusy] = useState(false);

  const press = async ({ task, failure }: PressParams) => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await task();
    } catch (error) {
      await reportError({ title: failure, error, sessionId });
    } finally {
      setIsBusy(false);
    }
  };

  switch (verb.kind) {
    case 'primary':
      return <RunPrimaryAction session={session} view={view} primary={verb.primary} />;
    case 'continueStep':
      return (
        <Button
          size="xs"
          variant="secondary"
          isBusy={isBusy}
          onClick={() =>
            void press({
              task: () => continueStoppedAgent({ sessionId, agentId: verb.agentId }),
              failure: "Couldn't continue the step",
            })
          }
        >
          {NAMES.continue}
        </Button>
      );
    case 'viewTranscript':
      return (
        <button
          type="button"
          className={QUIET_VERB}
          onClick={() =>
            openDrawer({ kind: 'transcript', sessionId, payload: { agentId: verb.agentId } })
          }
        >
          View transcript
        </button>
      );
    case 'readQueued':
      return (
        <Button
          size="xs"
          variant="secondary"
          isBusy={isBusy}
          onClick={() =>
            void press({
              task: () => readQueuedWorkflowHints({ sessionId, workflowRunId: runId }),
              failure: "Couldn't read the queued hints",
            })
          }
        >
          {verb.isStopped ? `Continue and read ${verb.count} queued` : `Read ${verb.count} queued`}
        </Button>
      );
    case 'quiet':
      return (
        <Button
          size="xs"
          variant="secondary"
          isBusy={isBusy}
          busyLabel="Asking"
          onClick={() =>
            void press({
              task: () => askAgentToContinue({ sessionId, agentId: verb.agentId }),
              failure: "Couldn't ask the step to continue",
            })
          }
        >
          Ask it to continue
        </Button>
      );
    case 'resumeAll':
      return (
        <Button
          size="xs"
          variant="secondary"
          isBusy={isBusy}
          onClick={() =>
            void press({
              task: () => resumeStoppedAgents({ sessionId, workflowRunId: runId }),
              failure: "Couldn't continue the stopped agents",
            })
          }
        >
          {verb.count === 1 ? NAMES.continue : NAMES.continueAll}
        </Button>
      );
    default: {
      const exhaustive: never = verb;
      return exhaustive;
    }
  }
};
