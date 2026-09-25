import { useState } from 'react';
import type { StepDefId, WorkspaceId } from '@goodboy/types';
import { useToast } from '../../../../app/components/Toast';
import { useAppStore } from '../../../../store';
import type { StepDraft } from '../../engine';
import { stepDefArgsFromDraft } from '../../savedSteps';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly onLinked: (key: string, libraryStepId: StepDefId) => void;
  readonly onError: (message: string) => void;
};

export const useSaveAsStep = ({ workspaceId, onLinked, onError }: Params) => {
  const saveStepDef = useAppStore((state) => state.saveStepDef);
  const { showToast } = useToast();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const saveAsStep = async (step: StepDraft) => {
    if (step.name.trim() === '' || savingKey !== null) {
      return;
    }
    setSavingKey(step.key);
    try {
      const saved = await saveStepDef(
        stepDefArgsFromDraft({ draft: step, workspaceId, baseStepId: step.libraryStepId }),
        workspaceId,
      );
      onLinked(step.key, saved.id);
      showToast({ kind: 'success', message: `Saved ${saved.name} to your saved steps.` });
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingKey(null);
    }
  };

  return { savingKey, saveAsStep };
};
