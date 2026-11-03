import { restoreOrchestratorHintDraft } from './restoreOrchestratorHintDraft';
import { setOrchestratorHintDraft } from './setOrchestratorHintDraft';
import type { SliceDeps } from '../../slice-types';

export const createOrchestratorHintDraftsSlice = ({ set }: SliceDeps) => {
  return {
    setOrchestratorHintDraft: setOrchestratorHintDraft({ set }),
    restoreOrchestratorHintDraft: restoreOrchestratorHintDraft({ set }),
  };
};
