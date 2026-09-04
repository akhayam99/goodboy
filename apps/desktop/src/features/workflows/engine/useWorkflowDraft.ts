import { useState } from 'react';
import type { StepDraft, WorkflowDraft } from './types';
import { addStep, removeStep, reorderSteps, updateStep } from './index';

type Params = { readonly initial: WorkflowDraft };

type AddStepParams = { readonly step?: StepDraft; readonly atIndex?: number };
type RemoveStepParams = { readonly key: string };
type UpdateStepParams = { readonly key: string; readonly patch: Partial<StepDraft> };
type ReorderStepsParams = { readonly from: number; readonly to: number };

export const useWorkflowDraft = ({ initial }: Params) => {
  const [draft, setDraft] = useState(initial);
  return {
    draft,
    setDraft,
    updateMeta: (patch: Partial<Omit<WorkflowDraft, 'steps'>>) =>
      setDraft((current) => ({ ...current, ...patch })),
    addStep: ({ step, atIndex }: AddStepParams) =>
      setDraft((current) => ({
        ...current,
        steps: addStep({
          steps: current.steps,
          ...(step !== undefined && { step }),
          ...(atIndex !== undefined && { atIndex }),
        }),
      })),
    removeStep: ({ key }: RemoveStepParams) =>
      setDraft((current) => ({
        ...current,
        steps: removeStep({ steps: current.steps, key }),
      })),
    updateStep: ({ key, patch }: UpdateStepParams) =>
      setDraft((current) => ({
        ...current,
        steps: updateStep({ steps: current.steps, key, patch }),
      })),
    reorderSteps: ({ from, to }: ReorderStepsParams) =>
      setDraft((current) => ({
        ...current,
        steps: reorderSteps({ steps: current.steps, from, to }),
      })),
  };
};
