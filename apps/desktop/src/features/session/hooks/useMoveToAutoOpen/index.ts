import { useEffect, useState } from 'react';
import type { AgentId } from '@goodboy/types';
import { MOVE_TO_AUTO_EVENT, isMoveToAutoFor } from '../../../auto/adopt/moveToAutoEvent';

type Params = {
  readonly agentId: AgentId;
};

type MoveToAutoOpen = Readonly<{
  isMoveOpen: boolean;
  setIsMoveOpen: (isOpen: boolean) => void;
}>;

export const useMoveToAutoOpen = ({ agentId }: Params): MoveToAutoOpen => {
  const [isMoveOpen, setIsMoveOpen] = useState(false);

  useEffect(() => {
    setIsMoveOpen(false);
  }, [agentId]);

  useEffect(() => {
    const controller = new AbortController();
    window.addEventListener(
      MOVE_TO_AUTO_EVENT,
      (event) => {
        if (isMoveToAutoFor({ event, agentId })) {
          setIsMoveOpen(true);
        }
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [agentId]);

  return { isMoveOpen, setIsMoveOpen };
};
