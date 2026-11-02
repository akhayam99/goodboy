import { useEffect } from 'react';
import { invokeCommand } from '../../../../shared/lib/invokeCommand';
import { startPoll } from '../../../../shared/lib/usePoll/startPoll';

const HEARTBEAT_MS = 5_000;

type Params = {
  readonly onResumed: () => void;
};

type HeartbeatReply = {
  readonly hasResumed: boolean;
};

export const useWindowHeartbeat = ({ onResumed }: Params): void => {
  useEffect(() => {
    let isActive = true;
    const beat = async (): Promise<void> => {
      try {
        const reply = await invokeCommand<HeartbeatReply | null | undefined>('window_heartbeat', {
          isVisible: document.visibilityState === 'visible',
        });
        if (isActive && reply?.hasResumed === true) {
          onResumed();
        }
      } catch {
        return;
      }
    };
    const stopPoll = startPoll({
      run: () => void beat(),
      everyMs: HEARTBEAT_MS,
      gate: 'always',
      isImmediate: true,
    });
    const onVisibility = (): void => void beat();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      isActive = false;
      stopPoll();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [onResumed]);
};
