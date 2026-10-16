import type { Session } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../../../store';
import { PaneShell, useEscapeLayer } from '@goodboy/ui';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { WorkflowAttachButton } from '../../../../workflows/components/WorkflowAttachButton';
import { WorkflowStartButton } from '../../AgentTree/WorkflowStartButton';
import { OrchestratedRunPage } from '../../OrchestratedRun';
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
  const navigate = useAppStore((state) => state.navigate);
  const focusedRun =
    attachedRuns.find(
      ({ run }) => run.id === focusedWorkflowRunId && run.executionMode === 'dynamic',
    ) ?? null;
  useEscapeLayer(
    () => navigate({ to: sessionPlace({ sessionId, lens: 'orchestrated' }) }),
    focusedRun !== null && isActive,
  );
  const presetRuns = attachedRuns.filter(({ run }) => run.executionMode !== 'dynamic');
  const hasRuns = presetRuns.length > 0;

  if (focusedRun != null) {
    return (
      <OrchestratedRunPage session={session} run={focusedRun.run} workflow={focusedRun.workflow} />
    );
  }

  return (
    <PaneShell
      title={NAMES.runs}
      actions={hasRuns ? <WorkflowAttachButton sessionId={sessionId} placement="header" /> : null}
    >
      {hasRuns ? (
        <RunsGrid session={session} attachedRuns={presetRuns} />
      ) : (
        <WorkflowStartButton sessionId={sessionId} />
      )}
    </PaneShell>
  );
};
