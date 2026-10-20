import type { Agent, AgentId } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { autoRetryRouteOf } from '../../store/slices/turn/autoRetryRouteOf';
import { autoGroupOf, type AutoGroupChild } from './autoGroupOf';
import { isAutoPlanAwaitingApproval } from './isAutoPlanAwaitingApproval';

type AutoRetryTargetKind = 'neverStarted' | 'failed' | 'approve' | 'blocked';

export type AutoRetryTarget = Readonly<{
  agentId: AgentId;
  rootAgentId: AgentId;
  role: string;
  kind: AutoRetryTargetKind;
  reason: string | null;
  canRetry: boolean;
}>;

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly agents: ReadonlyArray<Agent>;
  readonly now: number;
};

type ChildParams = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly agents: ReadonlyArray<Agent>;
  readonly rootAgentId: AgentId;
  readonly child: AutoGroupChild;
};

const targetOfChild = ({
  views,
  agents,
  rootAgentId,
  child,
}: ChildParams): AutoRetryTarget | null => {
  const isBroken =
    child.state === 'neverStarted' ||
    child.state === 'failed' ||
    child.state === 'timedOut' ||
    child.state === 'blocked';
  if (!isBroken) {
    return null;
  }
  return {
    agentId: child.agentId,
    rootAgentId,
    role: child.noun,
    kind: child.state === 'neverStarted' ? 'neverStarted' : 'failed',
    reason: child.reason,
    canRetry: autoRetryRouteOf({ views, runs: agents, agentId: child.agentId }) !== null,
  };
};

type OwnParams = {
  readonly rootAgentId: AgentId;
  readonly kind: 'approve' | 'blocked';
};

const ownTargetOf = ({ rootAgentId, kind }: OwnParams): AutoRetryTarget => ({
  agentId: rootAgentId,
  rootAgentId,
  role: 'Auto',
  kind,
  reason: null,
  canRetry: false,
});

export const autoRetryTargetsOf = ({
  views,
  agents,
  now,
}: Params): ReadonlyArray<AutoRetryTarget> =>
  views.flatMap((view) => {
    const phase = view.tree.phase;
    if (phase === 'finished' || phase === 'stopped') {
      return [];
    }
    const rootAgentId = view.tree.rootAgentId;
    const group = autoGroupOf({ view, agents, now });
    const children = (group?.children ?? []).flatMap((child) => {
      const target = targetOfChild({ views, agents, rootAgentId, child });
      return target === null ? [] : [target];
    });
    return [
      ...children,
      ...(isAutoPlanAwaitingApproval({ view })
        ? [ownTargetOf({ rootAgentId, kind: 'approve' })]
        : []),
      ...(phase === 'blocked' ? [ownTargetOf({ rootAgentId, kind: 'blocked' })] : []),
    ];
  });
