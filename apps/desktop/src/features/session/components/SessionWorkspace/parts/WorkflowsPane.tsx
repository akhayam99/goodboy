import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { GoneObject } from '../../../../../shared/components/GoneObject';
import { PANE_RHYTHM, PaneShell, cn } from '@goodboy/ui';
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
};

export const WorkflowsPane = ({ session }: Props) => {
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
  const isRunGone =
    focusedWorkflowRunId !== null &&
    !session.workflowRuns.some((run) => run.id === focusedWorkflowRunId);

  if (focusedRun != null) {
    return (
      <OrchestratedRunPage session={session} run={focusedRun.run} workflow={focusedRun.workflow} />
    );
  }

  if (isRunGone) {
    return (
      <PaneShell page="run" title="Run">
        <GoneObject
          noun="run"
          icon={CONCEPT_ICONS.workflows}
          onBack={() => leaveRunLevel({ sessionId })}
        />
      </PaneShell>
    );
  }

  return (
    <PaneShell page="runs" title={NAMES.runs} subheader={<SessionPageIntro page="runs" />}>
      <div className={cn(PANE_RHYTHM.groups, 'min-w-0')}>
        <StartRun workspaceId={session.workspaceId} sessionId={sessionId} />
        {runs.length > 0 ? <RunsGrid session={session} runs={runs} /> : null}
      </div>
    </PaneShell>
  );
};
