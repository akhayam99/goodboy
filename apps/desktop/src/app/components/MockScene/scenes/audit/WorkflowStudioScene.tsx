import { useEffect, useState } from 'react';
import { WORKFLOW_LIBRARY, normalizeAgentRole } from '@goodboy/core';
import type { StepId, Workflow, WorkflowId } from '@goodboy/types';
import { WorkflowStudio } from '../../../../../features/workflows/components/WorkflowStudio';
import { useAppStore } from '../../../../../store';
import { WorkflowBuilderScene } from '../flow-audit/WorkflowBuilderScene';
import { NOW, WORKSPACE_ID } from '../flow-audit/fixtures';
import { sceneParam } from './sceneParams';
import { useSceneClicks } from './useSceneClicks';

const noop = () => undefined;

const IS_EMPTY = sceneParam({ key: 'v' }) === 'empty';
const OPEN = sceneParam({ key: 'open' });
const OPEN_LABELS: ReadonlyArray<string> = OPEN === null ? [] : OPEN.split(',');
const IS_CONFIRM_ERROR = sceneParam({ key: 'state' }) === 'confirm-error';

const editedBuiltin = (): Workflow | null => {
  const entry = WORKFLOW_LIBRARY[0];
  if (entry === undefined) {
    return null;
  }
  const id = `wf_seed_${entry.slug}_${WORKSPACE_ID}` as WorkflowId;
  return {
    id,
    workspaceId: WORKSPACE_ID,
    name: `${entry.name} ledger-core`,
    description: entry.description,
    origin: 'library',
    isPreset: true,
    steps: entry.steps.map((step, ordinal) => ({
      id: `step_seed_${entry.slug}_${ordinal}_${WORKSPACE_ID}` as StepId,
      workflowId: id,
      role: normalizeAgentRole({ role: step.role }),
      ordinal,
      name: step.name,
      promptPrefix: step.promptPrefix,
      expectedOutput: step.expectedOutput,
    })),
    createdAt: NOW,
    updatedAt: NOW,
  };
};

const seedStudio = (): void => {
  useAppStore.setState({
    loadPhaseTemplates: async () => undefined,
    loadStepLibrary: async () => undefined,
    setWorkflowStudioVisible: noop,
    savePhaseTemplate: async (args) => {
      const kept = (useAppStore.getState().phaseTemplates[WORKSPACE_ID] ?? []).find(
        (workflow) => workflow.id === args.id,
      );
      if (kept === undefined) {
        throw new Error('This mock keeps the workflows it opened with.');
      }
      return kept;
    },
  });
  if (IS_CONFIRM_ERROR) {
    const workflow = editedBuiltin();
    useAppStore.setState({
      phaseTemplates: workflow === null ? {} : { [WORKSPACE_ID]: [workflow] },
      resetWorkflows: async () => {
        throw new Error('Refactor is running in Northwind checkout. Restore it when the run ends.');
      },
    });
    return;
  }
  if (!IS_EMPTY) {
    return;
  }
  useAppStore.setState({
    phaseTemplates: { [WORKSPACE_ID]: [] },
    stepLibrary: { [WORKSPACE_ID]: [] },
  });
};

export const WorkflowStudioScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedStudio();
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: IS_CONFIRM_ERROR
      ? ['Workflow actions', 'Restore built-in workflows', 'Restore 1']
      : OPEN_LABELS,
    selector: '[data-studio-overlay] button',
    match: 'contains',
    intervalMs: 200,
  });

  return (
    <>
      <WorkflowBuilderScene />
      {isReady && <WorkflowStudio workspaceId={WORKSPACE_ID} onClose={noop} />}
    </>
  );
};
