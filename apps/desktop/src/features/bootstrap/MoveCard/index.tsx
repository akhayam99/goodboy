import { useState } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type { Project } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionPlace } from '../../../store/slices/navigation/place';

type Props = {
  readonly project: Project;
  readonly changedCount: number | null;
  readonly isTurnRunning: boolean;
};

const plural = (count: number): string => (count === 1 ? 'file' : 'files');

export const MoveCard = ({ project, changedCount, isTurnRunning }: Props) => {
  const moveToBootstrap = useAppStore((state) => state.moveToBootstrap);
  const navigate = useAppStore((state) => state.navigate);
  const [isMoving, setIsMoving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const move = async () => {
    setIsMoving(true);
    setMessage(null);
    try {
      const result = await moveToBootstrap({ projectId: project.id });
      if (result.kind === 'moved') {
        navigate({ to: sessionPlace({ sessionId: result.session.id }) });
        return;
      }
      if (result.kind === 'refused') {
        setMessage(result.message);
      }
    } finally {
      setIsMoving(false);
    }
  };

  const hasWork = changedCount !== null && changedCount > 0;
  const actionLabel = hasWork ? 'Move my work' : 'Finish';

  return (
    <section
      aria-label="Move your work"
      className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle p-4"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-label text-foreground">
          Move your work into a session called bootstrap
        </h3>
        <p className="text-secondary text-muted-foreground">
          {hasWork
            ? `${changedCount} changed ${plural(changedCount)} in the project folder move into a worktree session. The folder ends clean on main.`
            : 'The project folder has no changed files. Finish to start worktree sessions.'}
        </p>
      </div>
      {message !== null ? (
        <Notice tone="warning" placement="inline" role="alert" title={message} />
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={isMoving || isTurnRunning}
          aria-busy={isMoving}
          onClick={() => void move()}
        >
          {isMoving ? 'Moving' : actionLabel}
        </Button>
        {isTurnRunning ? (
          <span className="text-secondary text-muted-foreground">
            Wait for the running turn to finish
          </span>
        ) : null}
      </div>
    </section>
  );
};
