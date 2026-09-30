import { Button } from '@goodboy/ui';
import type { Agent, SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { isStoppedByRestart } from '../../../../../store/slices/turn/isStoppedByRestart';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { usePendingAction } from '../../../../../shared/hooks/usePendingAction';

type Props = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly agents: ReadonlyArray<Agent>;
};

const RESUME_KEY = 'resume-workflow-agents';

export const WorkflowResumeStrip = ({ sessionId, runId, agents }: Props) => {
  const resumeStoppedAgents = useAppStore((state) => state.resumeStoppedAgents);
  const pending = usePendingAction({ sessionId });
  const stoppedCount = agents.filter((agent) => isStoppedByRestart({ agent })).length;
  if (stoppedCount === 0) {
    return null;
  }
  const Icon = CONCEPT_ICONS.retry;
  const title =
    stoppedCount === 1
      ? '1 agent stopped when Goodboy closed'
      : `${stoppedCount} agents stopped when Goodboy closed`;

  return (
    <div
      data-testid="workflow-resume-strip"
      className="flex w-full items-center gap-3 rounded-lg border border-border-soft bg-elevated px-4 py-3"
    >
      <Icon size={ICON_SIZE.control} className="shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body text-foreground">{title}</span>
        <span className="truncate text-label text-muted-foreground">
          What they wrote is kept. The run goes on once they finish.
        </span>
      </span>
      <Button
        size="sm"
        variant="secondary"
        emphasis="outline"
        isBusy={pending.pendingKeys.has(RESUME_KEY)}
        onClick={() =>
          void pending.run({
            key: RESUME_KEY,
            failureTitle: "Couldn't resume the stopped agents",
            task: () => resumeStoppedAgents({ sessionId, workflowRunId: runId }),
          })
        }
      >
        {stoppedCount === 1 ? 'Resume' : 'Resume all'}
      </Button>
    </div>
  );
};
