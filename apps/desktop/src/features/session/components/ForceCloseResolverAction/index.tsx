import { useEffect, useState } from 'react';
import { CircleStop } from 'lucide-react';
import type { Agent, SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { ResolverStatus } from '../../resolver-linkage';
import { canForceCloseResolver } from './canForceCloseResolver';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
};

export const ForceCloseResolverAction = ({ agent, sessionId, status }: Props) => {
  const forceCloseResolver = useAppStore((state) => state.forceCloseResolver);
  const [isArmed, setIsArmed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setIsArmed(false);
  }, [agent.id]);

  if (!canForceCloseResolver({ agent, status })) {
    return null;
  }

  const onConfirm = async () => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    setIsArmed(false);
    try {
      await forceCloseResolver(sessionId, agent.id);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={isBusy}
      title="stop this resolver now and let the next queued one run"
      onClick={(event) => {
        event.stopPropagation();
        if (isArmed) {
          void onConfirm();
          return;
        }
        setIsArmed(true);
      }}
      onBlur={() => setIsArmed(false)}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border border-danger/40 px-2 py-0.5 text-[10px] font-semibold text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60',
        isBusy && 'animate-border-pulse',
      )}
    >
      <CircleStop size={9} aria-hidden />
      {isBusy ? 'Stopping...' : isArmed ? 'Confirm stop' : 'Force close'}
    </button>
  );
};
