import type { Agent, AgentId } from '@goodboy/types';
import { ForceCloseResolverAction } from '../ForceCloseResolverAction';
import { ForceResolveAction } from '../ForceResolveAction';
import type { ResolverStatus } from '../../resolver-linkage';
import { ResolverPushAction } from './ResolverPushAction';

type Props = {
  readonly agent: Agent;
  readonly status: ResolverStatus;
  readonly threadIds: ReadonlyArray<string>;
  readonly onResolveThread: (threadId: string) => Promise<void> | void;
  readonly onResolveAgent: (agentId: AgentId) => Promise<void> | void;
};

export const ResolverCardFooter = ({
  agent,
  status,
  threadIds,
  onResolveThread,
  onResolveAgent,
}: Props) => {
  const isPushable = status === 'committed' || (threadIds.length === 1 && status === 'wontfix');
  const pushThreadId = isPushable ? (threadIds[0] ?? null) : null;

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-1.5"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {pushThreadId !== null && (
        <ResolverPushAction
          agentId={agent.id}
          threadId={pushThreadId}
          isCombined={threadIds.length >= 2}
          onResolveThread={onResolveThread}
          onResolveAgent={onResolveAgent}
        />
      )}
      <ForceCloseResolverAction agent={agent} sessionId={agent.sessionId} status={status} />
      <ForceResolveAction agent={agent} sessionId={agent.sessionId} status={status} />
    </div>
  );
};
