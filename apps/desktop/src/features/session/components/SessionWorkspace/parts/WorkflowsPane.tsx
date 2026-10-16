import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { PaneShell, useEscapeLayer } from '@goodboy/ui';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { WorkflowAttachButton } from '../../../../workflows/components/WorkflowAttachButton';
import { WorkflowStartButton } from '../../AgentTree/WorkflowStartButton';
import { WorkflowRunDetail } from './WorkflowRunDetail';
import { RunsGrid } from './RunsGrid';
import { NAMES } from '../../../../../shared/names';

type Props = {
  readonly session: Session;
  readonly isActive?: boolean;
};

export const WorkflowsPane = ({ session, isActive = true }: Props) => {
  const sessionId = session.id;
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const focusedWorkflowRunId = useAppStore(
    (state) => state.focusedWorkflowRunId[sessionId] ?? null,
  );
  const setFocusedWorkflowRun = useAppStore((state) => state.setFocusedWorkflowRun);
  const focusedRun =
    attachedRuns.find(
      ({ run }) => run.id === focusedWorkflowRunId && run.executionMode === 'dynamic',
    ) ?? null;
  useEscapeLayer(() => setFocusedWorkflowRun(sessionId, null), focusedRun !== null && isActive);
  const hasRuns = attachedRuns.length > 0;

  if (focusedRun != null) {
    return (
      <WorkflowRunDetail session={session} run={focusedRun.run} workflow={focusedRun.workflow} />
    );
  }

  return (
    <PaneShell
      title={NAMES.runs}
      actions={hasRuns ? <WorkflowAttachButton sessionId={sessionId} placement="header" /> : null}
    >
      {hasRuns ? (
        <RunsGrid session={session} attachedRuns={attachedRuns} />
      ) : (
        <WorkflowStartButton sessionId={sessionId} />
      )}
    </PaneShell>
  );
};
