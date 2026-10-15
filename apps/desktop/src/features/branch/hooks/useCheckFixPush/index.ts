import { useCallback, useRef, useState } from 'react';
import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { pushCheckFix } from '../../checks/pushCheckFix';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly fixAgentId: AgentId | undefined;
};

export type CheckFixPush = {
  readonly isPushing: boolean;
  readonly push: () => Promise<void>;
};

export const useCheckFixPush = ({ sessionId, mountId, fixAgentId }: Params): CheckFixPush => {
  const reportError = useAppStore((state) => state.reportError);
  const [isPushing, setIsPushing] = useState(false);
  const isRunningRef = useRef(false);
  const push = useCallback(async () => {
    if (isRunningRef.current) {
      return;
    }
    isRunningRef.current = true;
    setIsPushing(true);
    try {
      await pushCheckFix({ sessionId, mountId, fixAgentId });
    } catch (error: unknown) {
      if (!isReportedError(error)) {
        void reportError({ title: "Couldn't push the branch", error, sessionId });
      }
    } finally {
      isRunningRef.current = false;
      setIsPushing(false);
    }
  }, [fixAgentId, mountId, reportError, sessionId]);
  return { isPushing, push };
};
