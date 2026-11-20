import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { GoneObject } from '../../../../../shared/components/GoneObject';
import { PANE_RHYTHM, PaneShell, cn, useEscapeLayer } from '@goodboy/ui';
import { leaveRunLevel } from '../../../../workflows/leaveRunLevel';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { OrchestratedRunPage } from '../../OrchestratedRun';
import { useRunsFilter } from '../../../hooks/useRunsFilter';
import { useSessionRuns } from '../../../hooks/useSessionRuns';
import { RunsGrid } from './RunsGrid';
import { StartRun } from '../../StartRun/StartRun';
import { startRunEventName } from '../../../startRun/startRunEventName';
import { SessionPageIntro } from '../../SessionPageIntro';

type Props = {
  readonly session: Session;
};

export const WorkflowsPane = ({ session }: Props) => {
  const sessionId = session.id;
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const runs = useSessionRuns({ session });
  const filter = useRunsFilter({ sessionId });
  const [isStartOpen, setIsStartOpen] = useState(false);
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
  const hasRuns = runs.some((run) => !run.isArchived);
  const isListShown = focusedRun == null && !isRunGone;
  const isGridShown = hasRuns || filter.isRunningOnly;
  const isFormShown = !isGridShown || isStartOpen;

  useEffect(() => {
    const name = startRunEventName({ sessionId });
    const open = (): void => setIsStartOpen(true);
    window.addEventListener(name, open);
    return () => window.removeEventListener(name, open);
  }, [sessionId]);

  useEffect(() => {
    if (!isListShown) {
      setIsStartOpen(false);
    }
  }, [isListShown]);

  useEscapeLayer(() => setIsStartOpen(false), isGridShown && isStartOpen && isListShown);

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
    <PaneShell page="runs" subheader={<SessionPageIntro page="runs" />}>
      <div className={cn(PANE_RHYTHM.groups, 'min-w-0')}>
        <div hidden={!isFormShown}>
          <StartRun
            workspaceId={session.workspaceId}
            sessionId={sessionId}
            onStarted={() => setIsStartOpen(false)}
          />
        </div>
        {isGridShown ? <RunsGrid session={session} runs={runs} /> : null}
      </div>
    </PaneShell>
  );
};
