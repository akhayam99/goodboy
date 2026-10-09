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
    <Notice
      tone="info"
      placement="inline"
      className="bg-transparent"
      title="Main is on the remote now. Move your work into a session called bootstrap"
      body={
        hasWork
          ? `${changedCount} changed ${plural(changedCount)} in the project folder move into a worktree session. The folder ends clean on main.`
          : 'The project folder has no changed files. Finish to start worktree sessions.'
      }
      actions={
        <Button
          size="sm"
          disabled={isMoving || isTurnRunning}
          aria-busy={isMoving}
          onClick={() => void move()}
        >
          {isMoving ? 'Moving' : actionLabel}
        </Button>
      }
    >
      {message !== null ? (
        <Notice tone="warning" placement="inline" role="alert" title={message} />
      ) : null}
      {isTurnRunning ? (
        <span className="text-meta text-muted-foreground">Wait for the running turn to finish</span>
      ) : null}
    </Notice>
  );
};
