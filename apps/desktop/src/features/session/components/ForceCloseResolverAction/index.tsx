import { useEffect, useState } from 'react';
import { CircleStop } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
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

  useEffect(() => setIsArmed(false), [agent.id]);

  if (!canForceCloseResolver({ agent, status })) {
    return null;
  }

  const onConfirm = async () => {
    await forceCloseResolver(sessionId, agent.id);
    setIsArmed(false);
  };

  if (isArmed) {
    return (
      <InlineConfirm
        role="danger"
        icon={<CircleStop size={12} aria-hidden />}
        title="Force close this resolver?"
        description="Stops it now and lets the next queued resolver run."
        confirmLabel="Force close"
        onConfirm={onConfirm}
        onCancel={() => setIsArmed(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsArmed(true)}
      title="stop this resolver now and let the next queued one run"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-danger/40 px-2 py-0.5 text-[10px] font-semibold text-danger motion-safe:transition-colors hover:bg-danger/10"
    >
      <CircleStop size={9} aria-hidden />
      Force close
    </button>
  );
};
