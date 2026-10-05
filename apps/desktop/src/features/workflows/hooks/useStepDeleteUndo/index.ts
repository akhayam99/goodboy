import { useAppStore } from '../../../../store/store';
import { useToast } from '../../../../shared/components/Toast';
import { ROLE_LABEL } from '../../../session/agent-kind';
import type { StepDraft } from '../../engine';

type StepsUpdater = (current: ReadonlyArray<StepDraft>) => ReadonlyArray<StepDraft>;

type Params = {
  readonly steps: ReadonlyArray<StepDraft>;
  readonly setSteps: (update: StepsUpdater) => void;
  readonly onDeleted?: (key: string) => void;
};

const nameOf = ({ step }: { readonly step: StepDraft }): string =>
  step.name.trim() === '' ? ROLE_LABEL[step.role] : step.name.trim();

export const useStepDeleteUndo = ({ steps, setSteps, onDeleted }: Params) => {
  const { showToast } = useToast();
  return (key: string) => {
    const index = steps.findIndex((candidate) => candidate.key === key);
    const step = steps[index];
    if (step === undefined) {
      return;
    }
    setSteps((current) => current.filter((candidate) => candidate.key !== key));
    onDeleted?.(key);
    useAppStore.getState().undoable({
      showToast,
      message: `Deleted step ${nameOf({ step })}`,
      undo: async () => {
        setSteps((current) =>
          current.some((candidate) => candidate.key === key)
            ? current
            : [...current.slice(0, index), step, ...current.slice(index)],
        );
      },
    });
  };
};
