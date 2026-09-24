import { useEffect, type RefObject } from 'react';
import type { WorkflowDraft } from '../../../engine';

export const WORKFLOW_AUTOSAVE_DELAY_MS = 700;

type Params = {
  readonly form: WorkflowDraft;
  readonly isEditing: boolean;
  readonly savedForm: RefObject<string | null>;
  readonly flush: () => Promise<boolean>;
};

type SavableParams = {
  readonly form: WorkflowDraft;
};

const isSavable = ({ form }: SavableParams): boolean =>
  form.name.trim().length > 0 && form.steps.every((step) => step.name.trim().length > 0);

export const useWorkflowAutosave = ({ form, isEditing, savedForm, flush }: Params): void => {
  useEffect(() => {
    if (!isEditing) {
      return;
    }
    if (JSON.stringify(form) === savedForm.current) {
      return;
    }
    if (!isSavable({ form })) {
      return;
    }
    const timer = setTimeout(() => {
      void flush();
    }, WORKFLOW_AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [flush, form, isEditing, savedForm]);
};
