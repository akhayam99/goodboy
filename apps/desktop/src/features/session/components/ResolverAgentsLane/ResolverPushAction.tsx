import { useState } from 'react';
import { Upload } from 'lucide-react';
import { StatusDot, cn } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';

type Props = {
  readonly agentId: AgentId;
  readonly threadId: string;
  readonly isCombined: boolean;
  readonly onResolveThread: (threadId: string) => Promise<void> | void;
  readonly onResolveAgent: (agentId: AgentId) => Promise<void> | void;
};

export const ResolverPushAction = ({
  agentId,
  threadId,
  isCombined,
  onResolveThread,
  onResolveAgent,
}: Props) => {
  const [isPushing, setIsPushing] = useState(false);

  const onPush = async () => {
    if (isPushing) {
      return;
    }
    setIsPushing(true);
    try {
      if (isCombined) {
        await onResolveAgent(agentId);
        return;
      }
      await onResolveThread(threadId);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onPush()}
      disabled={isPushing}
      title="push the branch and resolve this comment now"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-info/40 px-2 py-0.5 text-[10px] font-semibold text-info transition-colors hover:bg-info/10 disabled:cursor-not-allowed disabled:opacity-60',
        isPushing && 'animate-border-pulse',
      )}
    >
      {isPushing ? <StatusDot tone="info" size="sm" pulsing /> : <Upload size={9} aria-hidden />}
      {isPushing ? 'Pushing...' : 'Push & resolve this'}
    </button>
  );
};
