import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { NOTHING_CHANGED } from '../../../../../store/slices/notifications/errorRecovery';
import type { SlackConfigUpdate } from '../../../../../store/slices/integrations/updateSlackConfig';
import { toError } from '../../../../../shared/utils/toError';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type SaveParams = {
  readonly update: SlackConfigUpdate;
};

type Failure = SaveParams & {
  readonly message: string;
};

export type SlackConfigSave = {
  readonly save: (params: SaveParams) => void;
  readonly error: string | null;
  readonly retry: () => void;
};

const FAILURE_TITLE = "Couldn't save the Slack setting";

export const useSlackConfigSave = ({ workspaceId }: Params): SlackConfigSave => {
  const updateSlackConfig = useAppStore((state) => state.updateSlackConfig);
  const reportError = useAppStore((state) => state.reportError);
  const [failure, setFailure] = useState<Failure | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const save = useCallback(
    ({ update }: SaveParams): void => {
      updateSlackConfig({ workspaceId, update }).catch((error: unknown) => {
        if (!isMounted.current) {
          void reportError({ recovery: NOTHING_CHANGED, title: FAILURE_TITLE, error, workspaceId });
          return;
        }
        setFailure({ update, message: toError({ value: error }).message });
      });
    },
    [reportError, updateSlackConfig, workspaceId],
  );

  const retry = useCallback(() => {
    if (failure === null) {
      return;
    }
    setFailure(null);
    save({ update: failure.update });
  }, [failure, save]);

  return { save, error: failure?.message ?? null, retry };
};
