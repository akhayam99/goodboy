import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../../store/store';
import { useToast } from '../../../../shared/components/Toast';
import { ROLE_LABEL } from '../../../session/agent-kind';
import type { StepDraft } from '../../engine';

type StepsUpdater = (current: ReadonlyArray<StepDraft>) => ReadonlyArray<StepDraft>;

type Params = {
  readonly steps: ReadonlyArray<StepDraft>;
  readonly setSteps: (update: StepsUpdater) => void;
  readonly contextKey: string | number | null;
  readonly onDeleted?: (key: string) => void;
};

const nameOf = ({ step }: { readonly step: StepDraft }): string =>
  step.name.trim() === '' ? ROLE_LABEL[step.role] : step.name.trim();

export const useStepDeleteUndo = ({ steps, setSteps, contextKey, onDeleted }: Params) => {
  const { showToast } = useToast();
  const contextRef = useRef(contextKey);
  contextRef.current = contextKey;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return (key: string) => {
    const index = steps.findIndex((candidate) => candidate.key === key);
    const step = steps[index];
    if (step === undefined) {
      return;
    }
    const capturedContext = contextRef.current;
    setSteps((current) => current.filter((candidate) => candidate.key !== key));
    onDeleted?.(key);
    useAppStore.getState().undoable({
      showToast,
      message: `Deleted step ${nameOf({ step })}`,
      isCurrent: () => mountedRef.current && contextRef.current === capturedContext,
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
