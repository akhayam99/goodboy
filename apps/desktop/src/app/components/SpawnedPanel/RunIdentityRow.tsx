import { Input, StateDot, Tooltip, FOCUS_RING, cn } from '@goodboy/ui';
import type { Session, Workflow, WorkflowRun } from '@goodboy/types';
import { useSessionOpenQuestions } from '../../../store';
import { useRunView } from '../../../features/session/components/AgentTree/useRunView';
import { useWorkflowRunTitleRename } from '../../../features/workflows/hooks/useWorkflowRunTitleRename';
import { runRowFactsOf } from '../../../features/workflows/runRowFactsOf';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export const RunIdentityRow = ({ session, run, workflow }: Props) => {
  const view = useRunView({ session, run, workflow });
  const questions = useSessionOpenQuestions(session.id);
  const facts = runRowFactsOf({
    run,
    workflow,
    agents: view.agents,
    predecessorName: view.predecessorName,
    isOrchestrating: view.isOrchestrating,
    questions,
  });
  const rename = useWorkflowRunTitleRename({
    sessionId: session.id,
    workflowRunId: run.id,
    currentTitle: view.name,
  });

  if (rename.editing) {
    return (
      <div data-level-identity="" className="flex flex-col gap-1 px-2 py-1">
        <Input
          autoFocus
          value={rename.draft}
          maxLength={rename.maxLength}
          onChange={(event) => rename.setDraft(event.target.value)}
          onBlur={() => void rename.commit()}
          onKeyDown={rename.onKeyDown}
          aria-label="Run name"
        />
      </div>
    );
  }

  return (
    <div data-level-identity="" className="flex h-8 min-w-0 items-center gap-2 px-2">
      <span className="flex size-4 shrink-0 items-center justify-center">
        <StateDot state={facts.dot} label={facts.word} />
      </span>
      <Tooltip content="Click to rename">
        <button
          type="button"
          onClick={rename.start}
          className={cn(
            'min-w-0 flex-1 cursor-text truncate rounded-md text-left text-row text-foreground',
            FOCUS_RING,
          )}
        >
          {view.name}
        </button>
      </Tooltip>
    </div>
  );
};
