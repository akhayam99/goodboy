import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Textarea, cn } from '@goodboy/ui';
import type { Session, Workflow, WorkflowId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { StartFooter } from './StartFooter';

type Props = {
  readonly session: Session;
  readonly onOpenWorkflowBuilder: () => void;
};

export const WorkflowStart = ({ session, onOpenWorkflowBuilder }: Props) => {
  const workflows = useAppStore(
    useShallow((state) =>
      (
        state.phaseTemplates[session.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>)
      ).filter((workflow) => workflow.deletedAt == null),
    ),
  );
  const loadPhaseTemplates = useAppStore((state) => state.loadPhaseTemplates);
  const attachWorkflowToSession = useAppStore((state) => state.attachWorkflowToSession);
  const reportError = useAppStore((state) => state.reportError);
  const [goal, setGoal] = useState('');
  const [pickedId, setPickedId] = useState<WorkflowId | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    void loadPhaseTemplates(session.workspaceId);
  }, [loadPhaseTemplates, session.workspaceId]);

  const picked = workflows.find((workflow) => workflow.id === pickedId) ?? workflows[0] ?? null;
  const trimmedGoal = goal.trim();
  const canRun = picked != null && trimmedGoal !== '' && !isStarting;

  const run = async () => {
    if (picked == null || trimmedGoal === '') {
      return;
    }
    setIsStarting(true);
    try {
      await attachWorkflowToSession(session.id, picked.id, { goal: trimmedGoal, navigate: true });
    } catch (error) {
      void reportError({ title: `Couldn't start ${picked.name}`, error, sessionId: session.id });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || !canRun) {
            return;
          }
          event.preventDefault();
          void run();
        }}
        aria-label="Workflow goal"
        placeholder="What should get done?"
        data-kickoff-field
        minRows={2}
        maxRows={8}
        autoGrow
        className="text-sm"
      />
      {workflows.length === 0 ? (
        <p className="px-2.5 text-xs text-muted-foreground">No workflows in this workspace yet.</p>
      ) : (
        <ul aria-label="Workflows" className="flex flex-col gap-0.5">
          {workflows.map((workflow) => {
            const isPicked = workflow.id === picked?.id;
            return (
              <li key={workflow.id}>
                <button
                  type="button"
                  aria-pressed={isPicked}
                  onClick={() => setPickedId(workflow.id)}
                  className={cn(
                    'flex w-full min-w-0 items-baseline gap-2 rounded-md px-2 py-1.5 text-left motion-safe:transition-colors',
                    isPicked ? 'bg-selected' : 'hover:bg-hover',
                  )}
                >
                  <span className="shrink-0 text-sm text-foreground">{workflow.name}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {workflow.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <StartFooter note={trimmedGoal === '' ? 'Write the goal first.' : null}>
        <Button variant="ghost" size="sm" onClick={onOpenWorkflowBuilder}>
          Open the builder
        </Button>
        <Button
          size="sm"
          disabled={!canRun}
          isBusy={isStarting}
          busyLabel="Starting workflow"
          onClick={() => void run()}
        >
          Run workflow
        </Button>
      </StartFooter>
    </div>
  );
};
