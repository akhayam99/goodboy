import { useEffect } from 'react';
import { invokeCommand } from '../../../../shared/lib/invokeCommand';

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
    const timer = window.setInterval(() => void beat(), HEARTBEAT_MS);
    const onVisibility = (): void => void beat();
    document.addEventListener('visibilitychange', onVisibility);
    void beat();
    return () => {
      isActive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [onResumed]);
};
