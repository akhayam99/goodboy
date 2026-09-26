import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Textarea } from '@goodboy/ui';
import type { Session, WorkflowId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectPresetWorkflows } from '../../../../store/slices/workflows/selectPresetWorkflows';
import { StartFooter } from './StartFooter';
import { WorkflowPresetGroup } from './WorkflowPresetGroup';

type Props = {
  readonly session: Session;
  readonly onOpenWorkflowBuilder: () => void;
};

export const WorkflowStart = ({ session, onOpenWorkflowBuilder }: Props) => {
  const workflows = useAppStore(
    useShallow((state) => selectPresetWorkflows({ state, workspaceId: session.workspaceId })),
  );
  const builtIn = workflows.filter((workflow) => workflow.origin === 'library');
  const saved = workflows.filter((workflow) => workflow.origin !== 'library');
  const loadPhaseTemplates = useAppStore((state) => state.loadPhaseTemplates);
  const attachWorkflowToSession = useAppStore((state) => state.attachWorkflowToSession);
  const reportError = useAppStore((state) => state.reportError);
  const [goal, setGoal] = useState('');
  const [pickedId, setPickedId] = useState<WorkflowId | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    void loadPhaseTemplates(session.workspaceId);
  }, [loadPhaseTemplates, session.workspaceId]);

  const picked =
    workflows.find((workflow) => workflow.id === pickedId) ?? builtIn[0] ?? saved[0] ?? null;
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
        <div className="flex flex-col gap-2">
          <WorkflowPresetGroup
            label="Built in"
            workflows={builtIn}
            pickedId={picked?.id ?? null}
            onPick={setPickedId}
          />
          <WorkflowPresetGroup
            label="Saved"
            workflows={saved}
            pickedId={picked?.id ?? null}
            onPick={setPickedId}
          />
        </div>
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
