import { Button } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { finishedWithGapsPhrase } from '../../workflows/finishedWithGapsPhrase';
import { notFinishedStepsOf } from '../../workflows/notFinishedStepsOf';
import { runPlace } from '../../workflows/runPlace';
import type { RunView } from './AgentTree/useRunView';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

export const RunNotFinishedLinks = ({ session, view }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const notFinished = notFinishedStepsOf({ agents: view.agents });
  if (!view.isCompleted || view.isDiscarded || notFinished.length === 0) {
    return null;
  }
  return (
    <p
      data-run-not-finished=""
      className="flex min-w-0 flex-wrap items-center gap-x-2 text-ui text-muted-foreground"
    >
      <span className="text-row-strong text-warning">
        {finishedWithGapsPhrase({ count: notFinished.length })}
      </span>
      {notFinished.map(({ agent, number }) => (
        <Button
          key={agent.id}
          variant="ghost"
          size="xs"
          onClick={() =>
            navigate({
              to: runPlace({ sessionId: session.id, runId: view.run.id, agentId: agent.id }),
            })
          }
        >
          {`Open step ${number}`}
        </Button>
      ))}
    </p>
  );
};
