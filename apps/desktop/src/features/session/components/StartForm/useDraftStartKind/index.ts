import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import { startFormKindOfDraft, type StartFormKind } from '../startFormKinds';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useDraftStartKind = ({ workspaceId }: Params): StartFormKind | null => {
  const startKind = useAppStore((state) => selectSessionDraft({ state, workspaceId }).startKind);
  const startShape = useAppStore((state) => selectSessionDraft({ state, workspaceId }).startShape);
  const workflowId = useAppStore((state) => selectSessionDraft({ state, workspaceId }).workflowId);
  const isWorkflowKnown = useAppStore((state) => {
    const templates = state.phaseTemplates[workspaceId];
    return (
      templates === undefined ||
      templates.some((entry) => entry.isPreset === true && entry.id === workflowId)
    );
  });
  const kind = startFormKindOfDraft({ startKind, startShape, workflowId });
  return kind === 'preset' && !isWorkflowKnown ? null : kind;
};
