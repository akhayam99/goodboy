import { Button } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { finishedWithGapsPhrase } from '../../workflows/finishedWithGapsPhrase';
import { notFinishedStepsOf } from '../../workflows/notFinishedStepsOf';
import type { RunView } from './AgentTree/useRunView';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly isPhraseShown: boolean;
};

export const RunNotFinishedLinks = ({ session, view, isPhraseShown }: Props) => {
  const openDrawer = useAppStore((state) => state.openDrawer);
  const notFinished = notFinishedStepsOf({ agents: view.agents });
  if (!view.isCompleted || view.isDiscarded || notFinished.length === 0) {
    return null;
  }
  return (
    <p
      data-run-not-finished=""
      className="flex min-w-0 flex-wrap items-center gap-x-2 text-ui text-muted-foreground"
    >
      {isPhraseShown ? (
        <span className="text-row-strong text-warning">
          {finishedWithGapsPhrase({ count: notFinished.length })}
        </span>
      ) : null}
      {notFinished.map(({ agent, number }) => (
        <Button
          key={agent.id}
          variant="ghost"
          size="xs"
          onClick={() =>
            openDrawer({
              kind: 'run-step',
              sessionId: session.id,
              payload: { runId: view.run.id, agentId: agent.id },
            })
          }
        >
          {`Go to step ${number}`}
        </Button>
      ))}
    </p>
  );
};
