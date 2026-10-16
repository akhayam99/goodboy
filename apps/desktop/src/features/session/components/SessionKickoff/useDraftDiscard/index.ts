import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import { hasSessionDraftContent } from '../../../../../store/slices/sessionDraft/hasSessionDraftContent';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useDraftDiscard = ({ workspaceId }: Params) => {
  const canDiscard = useAppStore((state) =>
    hasSessionDraftContent({ draft: selectSessionDraft({ state, workspaceId }) }),
  );
  const discardSessionDraft = useAppStore((state) => state.discardSessionDraft);
  const discard = () => discardSessionDraft({ workspaceId });
  return { canDiscard, discard };
};
