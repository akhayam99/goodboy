import { useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
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
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const start = async (spec: SessionDraftStart): Promise<boolean> => {
    if (busyRef.current) {
      return false;
    }
    busyRef.current = true;
    setIsStarting(true);
    setError(null);
    try {
      await startSessionFromDraft({ workspaceId, start: spec });
      return true;
    } catch (cause) {
      setError(formatError(cause));
      return false;
    } finally {
      busyRef.current = false;
      setIsStarting(false);
    }
  };

  return { start, isStarting, error };
};
