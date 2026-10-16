import { useState } from 'react';
import { Button } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { requestRunAddStep } from '../../../workflows/requestRunAddStep';
import { runPlace } from '../../../workflows/runPlace';
import { useAnswerQuestion } from '../../../workflows/useAnswerQuestion';
import { RaiseCapPrimary } from '../AgentTree/RunHeader/RaiseCapPrimary';
import { RunPrimaryAction } from '../AgentTree/RunHeader/RunPrimaryAction';
import type { RunView } from '../AgentTree/useRunView';
import type { RunTailVerb as RunTailVerbModel } from './runTailOf';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly verb: RunTailVerbModel;
};

type PressParams = {
  readonly task: () => Promise<void>;
  readonly failure: string;
};

const QUIET_VERB =
  'inline-flex h-6 items-center gap-1 rounded-md px-2 text-ui text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const RunTailVerb = ({ session, view, verb }: Props) => {
  const sessionId = session.id;
  const runId = view.run.id;
  const navigate = useAppStore((state) => state.navigate);
  const askAgentToContinue = useAppStore((state) => state.askAgentToContinue);
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const recoverStuckStep = useAppStore((state) => state.recoverStuckStep);
  const resumeStoppedAgents = useAppStore((state) => state.resumeStoppedAgents);
  const reportError = useAppStore((state) => state.reportError);
  const answer = useAnswerQuestion({ sessionId });
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
    case 'raiseCap':
      return <RaiseCapPrimary session={session} view={view} />;
    case 'answer':
      return (
        <Button size="sm" variant="primary" onClick={() => answer({ question: verb.question })}>
          Answer
        </Button>
      );
    case 'recover':
      return (
        <Button
          size="sm"
          variant="primary"
          isBusy={isBusy}
          busyLabel="Restarting"
          onClick={() =>
            void press({
              task: () => recoverStuckStep({ sessionId, workflowRunId: runId }),
              failure: "Couldn't restart the step",
            })
          }
        >
          Restart step
        </Button>
      );
    case 'quiet':
      return (
        <Button
          size="sm"
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
    case 'openStep':
      return (
        <button
          type="button"
          className={QUIET_VERB}
          onClick={() => navigate({ to: runPlace({ sessionId, runId, agentId: verb.agentId }) })}
        >
          {verb.label}
        </button>
      );
    case 'continueStep':
      return (
        <Button
          size="sm"
          variant="secondary"
          isBusy={isBusy}
          onClick={() =>
            void press({
              task: () => continueStoppedAgent({ sessionId, agentId: verb.agentId }),
              failure: "Couldn't continue the step",
            })
          }
        >
          Continue step
        </Button>
      );
    case 'addStep':
      return (
        <button
          type="button"
          className={QUIET_VERB}
          onClick={() => {
            navigate({ to: runPlace({ sessionId, runId }) });
            requestRunAddStep({ runId });
          }}
        >
          Add step
        </button>
      );
    case 'resumeAll':
      return (
        <Button
          size="sm"
          variant="secondary"
          isBusy={isBusy}
          onClick={() =>
            void press({
              task: async () => {
                await resumeStoppedAgents({ sessionId, workflowRunId: runId });
              },
              failure: "Couldn't resume the stopped agents",
            })
          }
        >
          {verb.count === 1 ? 'Resume' : 'Resume all'}
        </Button>
      );
    default: {
      const exhaustive: never = verb;
      return exhaustive;
    }
  }
};
