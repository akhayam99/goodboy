import { IconButton, Input } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useObjectMenuTrigger } from '../../../../actions/useObjectMenuTrigger';
import type { ActionViewing, WorkflowRunActionTarget } from '../../../../actions/types';
import { WorkflowRunStatus } from '../WorkflowRunStatus';
import { useWorkflowRunTitleRename } from '../../../../workflows/hooks/useWorkflowRunTitleRename';
import type { RunView } from '../useRunView';
import { RunHeaderActions } from './RunHeaderActions';
import { RunMeta } from './RunMeta';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

export const RunHeader = ({ session, view }: Props) => {
  const { run, workflow, name } = view;
  const target: WorkflowRunActionTarget = {
    kind: 'workflowRun',
    sessionId: session.id,
    runId: run.id,
  };
  const viewing: ActionViewing = { kind: 'workflowRun', id: run.id };
  const menu = useObjectMenuTrigger({
    target,
    anchorKey: `workflow-run:${run.id}`,
    viewing,
  });
  const rename = useWorkflowRunTitleRename({
    sessionId: session.id,
    workflowRunId: run.id,
    currentTitle: run.title ?? workflow.name,
  });

  return (
    <div data-testid="run-header" className="flex min-w-0 flex-col gap-1">
      <div
        data-slot="pane-title-row"
        className="flex h-8 min-w-0 items-center justify-between gap-4"
      >
        <div className="flex min-w-0 items-center gap-2">
          {rename.editing ? (
            <Input
              autoFocus
              value={rename.draft}
              maxLength={rename.maxLength}
              onChange={(event) => rename.setDraft(event.target.value)}
              onBlur={() => void rename.commit()}
              onKeyDown={rename.onKeyDown}
              aria-label="Run name"
              className="text-title"
            />
          ) : (
            <div
              className="group/name flex min-w-0 items-center gap-2"
              onContextMenu={menu.onContextMenu}
            >
              <h1 title={name} className="min-w-0 truncate text-title text-foreground">
                {name}
              </h1>
              <IconButton
                icon={CONCEPT_ICONS.rename}
                size="xs"
                iconSize={ICON_SIZE.row}
                label="Edit run name"
                onClick={rename.start}
                className="text-faint-foreground opacity-0 focus-visible:opacity-100 group-hover/name:opacity-100 motion-reduce:opacity-60"
              />
            </div>
          )}
          <WorkflowRunStatus
            run={run}
            workflow={workflow}
            agents={view.agents}
            predecessorName={view.predecessorName}
            isOrchestrating={view.isOrchestrating}
            hasOrchestratorStrip={view.isDynamic && !view.isDiscarded}
            blockReason={view.blockReason}
            isQuestionShownBelow
          />
        </div>
        <RunHeaderActions session={session} view={view} target={target} viewing={viewing} />
      </div>
      <RunMeta session={session} view={view} />
    </div>
  );
};
