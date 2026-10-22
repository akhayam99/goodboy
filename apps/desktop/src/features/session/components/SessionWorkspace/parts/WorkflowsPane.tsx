import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { Plus } from 'lucide-react';
import { Button, PaneShell, useEscapeLayer } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { openAutoForm } from '../../../../auto/openAutoForm';
import { useIsAutoOn } from '../../../../auto/useIsAutoOn';
import { leaveRunLevel } from '../../../../workflows/leaveRunLevel';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { WorkflowAttachButton } from '../../../../workflows/components/WorkflowAttachButton';
import { WorkflowStartButton } from '../../AgentTree/WorkflowStartButton';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { OrchestratedRunPage } from '../../OrchestratedRun';
import { createAgentEventName } from '../../../createAgentEventName';
import { useSessionRuns } from '../../../hooks/useSessionRuns';
import { RunsGrid } from './RunsGrid';
import { StartRun } from '../../StartRun/StartRun';
import { NAMES } from '../../../../../shared/names';
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
  const hasRuns = runs.length > 0;
  const isAutoOn = useIsAutoOn();

  if (focusedRun != null) {
    return (
      <OrchestratedRunPage session={session} run={focusedRun.run} workflow={focusedRun.workflow} />
    );
  }

  return (
    <PaneShell
      page="runs"
      title={NAMES.runs}
      subheader={<SessionPageIntro page="runs" />}
      actions={
        <>
          {hasRuns ? <WorkflowAttachButton sessionId={sessionId} placement="header" /> : null}
          {isAutoOn ? (
            <Button variant="secondary" size="sm" onClick={() => openAutoForm({ sessionId })}>
              <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              {NAMES.startAuto}
            </Button>
          ) : null}
          <CreateAgentPopover sessionId={sessionId} openEvent={createAgentEventName(sessionId)} />
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-6">
        <StartRun workspaceId={session.workspaceId} sessionId={sessionId} />
        {hasRuns ? (
          <RunsGrid session={session} runs={runs} />
        ) : (
          <WorkflowStartButton sessionId={sessionId} />
        )}
      </div>
    </PaneShell>
  );
};
