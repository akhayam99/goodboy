import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Textarea } from '@goodboy/ui';
import type { WorkflowId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectPresetWorkflows } from '../../../../store/slices/workflows/selectPresetWorkflows';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import type { Mode } from '../../../../store/slices/workflowDrafts/types';
import { ModeSwitch } from '../WorkflowBuilderView/parts/ModeSwitch';
import {
  readLastWorkflowMode,
  writeLastWorkflowMode,
} from '../WorkflowBuilderView/lastWorkflowMode';
import type { WorkflowStartChoice } from '../WorkflowBuilderView/builderDraftFor';
import { StartFooter } from './StartFooter';
import { WorkflowPresetGroup } from './WorkflowPresetGroup';
import { useDraftStart } from './useDraftStart';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkflowStart = ({ workspaceId }: Props) => {
  const workflows = useAppStore(
    useShallow((state) => selectPresetWorkflows({ state, workspaceId })),
  );
  const builtIn = workflows.filter((workflow) => workflow.origin === 'library');
  const saved = workflows.filter((workflow) => workflow.origin !== 'library');
  const loadPhaseTemplates = useAppStore((state) => state.loadPhaseTemplates);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const goal = useAppStore((state) => selectSessionDraft({ state, workspaceId }).workflowGoal);
  const pickedId = useAppStore((state) => selectSessionDraft({ state, workspaceId }).workflowId);
  const storedMode = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).workflowMode,
  );
  const { start, isStarting, error } = useDraftStart({ workspaceId });

  useEffect(() => {
    void loadPhaseTemplates(workspaceId);
  }, [loadPhaseTemplates, workspaceId]);

  const lastMode = readLastWorkflowMode({ workspaceId });
  const mode: Mode =
    storedMode ?? (lastMode === 'preset' && workflows.length === 0 ? 'dynamic' : lastMode);
  const picked =
    workflows.find((workflow) => workflow.id === pickedId) ?? builtIn[0] ?? saved[0] ?? null;
  const trimmedGoal = goal.trim();
  const isPreset = mode === 'preset';
  const canStart = trimmedGoal !== '' && !isStarting && (!isPreset || picked != null);

  const changeMode = (next: Mode) => {
    writeLastWorkflowMode({ workspaceId, mode: next });
    patchSessionDraft({ workspaceId, patch: { workflowMode: next } });
  };

  const pick = (workflowId: WorkflowId) => {
    patchSessionDraft({ workspaceId, patch: { workflowId } });
  };

  const builderChoice = (): WorkflowStartChoice | null => {
    if (mode === 'dynamic') {
      return { kind: 'orchestrated' };
    }
    if (mode === 'custom') {
      return { kind: 'custom' };
    }
    return picked == null ? null : { kind: 'preset', workflow: picked };
  };

  const openBuilder = () => {
    const choice = builderChoice();
    if (!canStart || choice === null) {
      return;
    }
    void start({ kind: 'workflow-builder', choice, goal: trimmedGoal });
  };

  const runPreset = () => {
    if (!canStart || picked == null) {
      return;
    }
    void start({ kind: 'workflow', workflowId: picked.id, goal: trimmedGoal });
  };

  const submit = isPreset ? runPreset : openBuilder;

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={goal}
        onChange={(event) =>
          patchSessionDraft({ workspaceId, patch: { workflowGoal: event.target.value } })
        }
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || !canStart) {
            return;
          }
          event.preventDefault();
          submit();
        }}
        aria-label="Workflow goal"
        placeholder="What should get done?"
        data-kickoff-field
        minRows={2}
        maxRows={8}
        autoGrow
        className="text-body"
      />
      <ModeSwitch mode={mode} disabled={isStarting} onChange={changeMode} />
      {isPreset && workflows.length === 0 ? (
        <p className="px-2.5 text-label text-muted-foreground">
          No workflows in this workspace yet.
        </p>
      ) : null}
      {isPreset && workflows.length > 0 ? (
        <div className="flex flex-col gap-2">
          <WorkflowPresetGroup
            label="Built in"
            workflows={builtIn}
            pickedId={picked?.id ?? null}
            onPick={pick}
          />
          <WorkflowPresetGroup
            label="Saved"
            workflows={saved}
            pickedId={picked?.id ?? null}
            onPick={pick}
          />
        </div>
      ) : null}
      <StartFooter note={trimmedGoal === '' ? 'Write the goal first.' : null} error={error}>
        {isPreset ? (
          <>
            <Button variant="ghost" size="sm" disabled={!canStart} onClick={openBuilder}>
              Edit steps
            </Button>
            <Button
              size="sm"
              disabled={!canStart}
              isBusy={isStarting}
              busyLabel="Starting workflow"
              onClick={runPreset}
            >
              Run workflow
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            disabled={!canStart}
            isBusy={isStarting}
            busyLabel="Opening the workflow"
            onClick={openBuilder}
          >
            {mode === 'dynamic' ? 'Set up orchestration' : 'Set up the steps'}
          </Button>
        )}
      </StartFooter>
    </div>
  );
};
