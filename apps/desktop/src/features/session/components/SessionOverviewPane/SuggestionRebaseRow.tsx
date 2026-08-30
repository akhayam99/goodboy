import { Button, Chip } from '@goodboy/ui';
import type { ProjectId, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useRebaseAgent } from '../../hooks/useRebaseAgent';

type Props = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly behind: number;
  readonly status: WorktreeStatus;
};

export const SuggestionRebaseRow = ({
  sessionId,
  projectId,
  projectName,
  behind,
  status,
}: Props) => {
  const setSessionActiveProject = useAppStore((state) => state.setSessionActiveProject);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const rebase = useRebaseAgent({
    sessionId,
    status,
    onError: (message) => {
      void emitNotification('error', 'error', 'Rebase failed', message, { sessionId });
    },
  });
  const runRebase = async () => {
    await setSessionActiveProject({ sessionId, projectId });
    await rebase.run();
  };

  return (
    <div className="flex w-full items-center gap-3 rounded-lg border-l-2 border-border-soft px-3 py-1.5">
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        Rebase {projectName} on main
      </span>
      <Chip tone="warning" size="3xs" bordered={false} label={`${behind} behind`} />
      <Button
        variant="secondary"
        emphasis="outline"
        size="sm"
        disabled={!rebase.canRebase || rebase.isRunning}
        onClick={() => void runRebase()}
      >
        {rebase.isRunning ? 'Rebasing' : 'Rebase'}
      </Button>
    </div>
  );
};
