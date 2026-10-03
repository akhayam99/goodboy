import type { StepPolishDeps } from '@goodboy/core';
import type { StepDraft } from './engine';
import type { Polish } from './hooks/usePolish';
import { polishWorkflowExpectedOutput, polishWorkflowStep } from './workflows';

export type PolishField = {
  readonly isPolishing: boolean;
  readonly isBusy: boolean;
  readonly canUndo: boolean;
  readonly onPolish: () => void;
  readonly onUndo: () => void;
};

export type StepPolishFields = {
  readonly prompt: PolishField;
  readonly expectedOutput: PolishField;
};

type Params = {
  readonly polish: Polish;
  readonly deps: Omit<StepPolishDeps, 'invokeFn'>;
  readonly goal: string;
  readonly step: StepDraft;
  readonly patchStep: (key: string, patch: Partial<StepDraft>) => void;
};

const KEPT_STEP = 'Kept your wording. The step could not be polished.';

export const stepPolishFields = ({
  polish,
  deps,
  goal,
  step,
  patchStep,
}: Params): StepPolishFields => {
  const promptId = `${step.key}:prompt`;
  const outputId = `${step.key}:expectedOutput`;
  const goalPart = goal.trim().length > 0 ? { goal } : {};
  const isBusy = polish.polishingId !== null;
  return {
    prompt: {
      isPolishing: polish.polishingId === promptId,
      isBusy,
      canUndo: polish.canUndo({ id: promptId, current: step.prompt }),
      onPolish: () =>
        void polish.run({
          id: promptId,
          current: step.prompt,
          keptMessage: KEPT_STEP,
          polish: () =>
            polishWorkflowStep({
              deps,
              input: { role: step.role, name: step.name, instruction: step.prompt, ...goalPart },
            }),
          apply: (prompt) => patchStep(step.key, { prompt }),
        }),
      onUndo: () =>
        polish.undo({
          id: promptId,
          current: step.prompt,
          apply: (prompt) => patchStep(step.key, { prompt }),
        }),
    },
    expectedOutput: {
      isPolishing: polish.polishingId === outputId,
      isBusy,
      canUndo: polish.canUndo({ id: outputId, current: step.expectedOutput }),
      onPolish: () =>
        void polish.run({
          id: outputId,
          current: step.expectedOutput,
          keptMessage: KEPT_STEP,
          polish: () =>
            polishWorkflowExpectedOutput({
              deps,
              input: {
                role: step.role,
                name: step.name,
                instruction: step.prompt,
                expectedOutput: step.expectedOutput,
                ...goalPart,
              },
            }),
          apply: (expectedOutput) => patchStep(step.key, { expectedOutput }),
        }),
      onUndo: () =>
        polish.undo({
          id: outputId,
          current: step.expectedOutput,
          apply: (expectedOutput) => patchStep(step.key, { expectedOutput }),
        }),
    },
  };
};
