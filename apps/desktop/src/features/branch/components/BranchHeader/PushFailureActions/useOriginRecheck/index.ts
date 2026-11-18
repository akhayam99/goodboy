import { useRef, useState } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../../../store';
import type { BranchOriginCheck } from '../../../../../../store/slices/history/types';

export type OriginRecheckPhase = 'idle' | 'checking' | 'pushing' | 'rebasing';

type ErrorParams = {
  readonly message: string | null;
};

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly onResolved: () => void;
  readonly onError: (params: ErrorParams) => void;
};

type OriginRecheck = {
  readonly phase: OriginRecheckPhase;
  readonly check: BranchOriginCheck | null;
  readonly checkAgain: () => Promise<void>;
  readonly forcePush: () => Promise<void>;
  readonly rebase: () => Promise<void>;
};

export const useOriginRecheck = ({ sessionId, mountId, onResolved, onError }: Params) => {
  const [phase, setPhase] = useState<OriginRecheckPhase>('idle');
  const [check, setCheck] = useState<BranchOriginCheck | null>(null);
  const latest = useRef(0);
  const checkAgain = async () => {
    const request = latest.current + 1;
    latest.current = request;
    setPhase('checking');
    onError({ message: null });
    try {
      const next = await useAppStore.getState().checkBranchOrigin({ sessionId, mountId });
      if (latest.current === request && next !== null) {
        setCheck(next);
      }
    } catch (error) {
      if (latest.current === request) {
        onError({ message: formatError(error) });
      }
    } finally {
      if (latest.current === request) {
        setPhase('idle');
      }
    }
  };
  const forcePush = async () => {
    if (check === null) {
      return;
    }
    setPhase('pushing');
    onError({ message: null });
    try {
      const result = await useAppStore
        .getState()
        .forcePushCheckedBranch({ sessionId, mountId, check });
      if (result.ok) {
        onResolved();
        return;
      }
      if (result.reason === 'moved') {
        setCheck(null);
      }
      onError({ message: result.error });
    } catch (error) {
      onError({ message: formatError(error) });
    } finally {
      setPhase('idle');
    }
  };
  const rebase = async () => {
    setPhase('rebasing');
    onError({ message: null });
    try {
      const outcome = await useAppStore.getState().bringOriginInAndPush({ sessionId, mountId });
      if (outcome === 'nothing') {
        setCheck(null);
        return;
      }
      onResolved();
    } catch (error) {
      onError({ message: formatError(error) });
    } finally {
      setPhase('idle');
    }
  };
  return { phase, check, checkAgain, forcePush, rebase } satisfies OriginRecheck;
};
