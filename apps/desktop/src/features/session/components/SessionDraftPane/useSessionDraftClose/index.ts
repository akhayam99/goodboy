import { useCallback, useState } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { hasSessionDraftContent } from '../../../../../store/slices/sessionDraft/hasSessionDraftContent';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type SessionDraftClose = {
  readonly isAsking: boolean;
  readonly keepDraft: () => void;
};

export const useSessionDraftClose = ({ workspaceId }: Params): SessionDraftClose => {
  const hasContent = useAppStore((state) =>
    hasSessionDraftContent({ draft: selectSessionDraft({ state, workspaceId }) }),
  );
  const closeSessionDraft = useAppStore((state) => state.closeSessionDraft);
  const [isAskRaised, setIsAskRaised] = useState(false);
  const isAsking = isAskRaised && hasContent;

  const keepDraft = useCallback(() => {
    setIsAskRaised(false);
    closeSessionDraft({ workspaceId });
  }, [closeSessionDraft, workspaceId]);

  const requestClose = useCallback(() => {
    if (hasContent && !isAsking) {
      setIsAskRaised(true);
      return;
    }
    keepDraft();
  }, [hasContent, isAsking, keepDraft]);

  useEscapeLayer(requestClose);

  return { isAsking, keepDraft };
};
