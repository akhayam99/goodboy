import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import type { SessionDraftStart } from '../../../../../store/slices/sessionDraft/startSessionFromDraft';
import { useStartFromDraft } from '../useStartFromDraft';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type Result = {
  readonly start: (spec: SessionDraftStart) => Promise<boolean>;
  readonly isStarting: boolean;
  readonly error: string | null;
};

export const useDraftStart = ({ workspaceId }: Params): Result => {
  const startSessionFromDraft = useStartFromDraft();
  const isStarting = useAppStore((state) => selectSessionDraft({ state, workspaceId }).isStarting);
  const error = useAppStore((state) => selectSessionDraft({ state, workspaceId }).startError);

  const start = async (spec: SessionDraftStart): Promise<boolean> => {
    try {
      await startSessionFromDraft({ workspaceId, start: spec });
      return true;
    } catch {
      return false;
    }
  };

  return { start, isStarting, error };
};
