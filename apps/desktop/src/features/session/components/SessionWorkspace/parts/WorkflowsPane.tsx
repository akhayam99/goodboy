import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { PaneShell, useEscapeLayer } from '@goodboy/ui';
import { leaveRunLevel } from '../../../../workflows/leaveRunLevel';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { OrchestratedRunPage } from '../../OrchestratedRun';
import { useSessionRuns } from '../../../hooks/useSessionRuns';
import { RunsGrid } from './RunsGrid';
import { StartRun } from '../../StartRun/StartRun';
import { NAMES } from '../../../../../shared/utils/names';
import { SessionPageIntro } from '../../SessionPageIntro';

type Props = {
  readonly session: Session;
  readonly isActive?: boolean;
};

export const WorkflowsPane = ({ session, isActive = true }: Props) => {
  const sessionId = session.id;
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const runs = useSessionRuns({ session });
  const focusedWorkflowRunId = useAppStore(
    (state) => state.focusedWorkflowRunId[sessionId] ?? null,
  );
  const focusedRun =
    attachedRuns.find(
      ({ run }) => run.id === focusedWorkflowRunId && run.executionMode === 'dynamic',
    ) ?? null;
  useEscapeLayer(() => leaveRunLevel({ sessionId }), focusedRun !== null && isActive);

  if (focusedRun != null) {
    return (
      <OrchestratedRunPage session={session} run={focusedRun.run} workflow={focusedRun.workflow} />
    );
  }

  return (
    <PaneShell page="runs" title={NAMES.runs} subheader={<SessionPageIntro page="runs" />}>
      <div className="flex min-w-0 flex-col gap-6">
        <StartRun workspaceId={session.workspaceId} sessionId={sessionId} />
        {runs.length > 0 ? <RunsGrid session={session} runs={runs} /> : null}
      </div>
    </PaneShell>
  );
};
