import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/core';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { resolveLimitedTaskModel } from '../../../../../store/slices/providerLimits/resolveLimitedTaskModel';
import { useAutoLimitContext } from '../../../../providers/hooks/useAutoLimitContext';
import { useToast } from '../../../../../app/components/Toast';
import type { WorkflowDraft } from '../../../engine';
import { updateStep } from '../../../engine';
import { polishWorkflowGoalText, polishWorkflowStep } from '../../../workflows';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly workingDir: string | null;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly form: WorkflowDraft;
  readonly setForm: Dispatch<SetStateAction<WorkflowDraft>>;
};

export const useWorkflowPolish = ({
  workspaceId,
  workingDir,
  connectedProviders,
  form,
  setForm,
}: Params) => {
  const overrides = useAppStore((state) => state.workspaceOverrides?.[workspaceId] ?? null);
  const { showToast } = useToast();
  const [goalHistory, setGoalHistory] = useState<ReadonlyArray<string>>([]);
  const [isPolishingGoal, setIsPolishingGoal] = useState(false);
  const [polishingKey, setPolishingKey] = useState<string | null>(null);
  const [polishError, setPolishError] = useState<string | null>(null);

  const limitContext = useAutoLimitContext();
  const taskModel = useMemo(
    () =>
      resolveLimitedTaskModel({
        limitContext,
        task: 'prose_polish',
        preferences: overrides?.taskModels,
        workspaceDefaultProviderId: overrides?.defaultProviderId,
        sessionDefaultProviderId:
          connectedProviders[0] ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
        connectedProviders: connectedProviders.length > 0 ? connectedProviders : null,
      }),
    [connectedProviders, limitContext, overrides],
  );
  const deps = { ...taskModel, ...(workingDir !== null && { workingDir }) };

  const polishGoal = async () => {
    const goal = form.goal;
    if (goal.trim().length === 0 || isPolishingGoal) {
      return;
    }
    setPolishError(null);
    setIsPolishingGoal(true);
    try {
      const polished = await polishWorkflowGoalText({ deps, goal });
      if (polished === null || polished === '') {
        showToast({
          kind: 'warning',
          message: 'Kept your wording. The goal could not be polished.',
        });
        return;
      }
      if (polished === goal) {
        return;
      }
      setGoalHistory((history) => [...history, goal]);
      setForm((current) => ({ ...current, goal: polished }));
    } catch (error) {
      setPolishError(formatError(error));
    } finally {
      setIsPolishingGoal(false);
    }
  };

  const undoGoal = () => {
    const previous = goalHistory[goalHistory.length - 1];
    if (previous === undefined) {
      return;
    }
    setGoalHistory((history) => history.slice(0, -1));
    setForm((current) => ({ ...current, goal: previous }));
  };

  const polishStep = async (key: string) => {
    const step = form.steps.find((candidate) => candidate.key === key);
    if (step === undefined || step.prompt.trim().length === 0 || polishingKey !== null) {
      return;
    }
    setPolishError(null);
    setPolishingKey(key);
    try {
      const polished = await polishWorkflowStep({
        deps,
        input: {
          role: step.role,
          name: step.name,
          instruction: step.prompt,
          ...(form.goal.trim().length > 0 && { goal: form.goal }),
        },
      });
      if (polished === null || polished === '') {
        showToast({
          kind: 'warning',
          message: 'Kept your wording. The step could not be polished.',
        });
        return;
      }
      if (polished === step.prompt) {
        return;
      }
      setForm((current) => ({
        ...current,
        steps: updateStep({ steps: current.steps, key, patch: { prompt: polished } }),
      }));
    } catch (error) {
      setPolishError(formatError(error));
    } finally {
      setPolishingKey(null);
    }
  };

  return {
    canUndoGoal: goalHistory.length > 0,
    isPolishingGoal,
    polishingKey,
    polishError,
    polishGoal,
    undoGoal,
    polishStep,
  };
};
