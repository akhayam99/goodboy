import { dockPlanOf } from './dockPlanOf';
import type { Agent, AgentId } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { autoRetryRouteOf } from '../../store/slices/turn/autoRetryRouteOf';
import { autoGroupOf, type AutoGroupChild } from './autoGroupOf';
import { autoStuckKindOf, type AutoStuckKind } from './autoStuckKindOf';
import { textField } from './chat/readJson';
import { isFailureSettled } from './isFailureSettled';
import { isAutoPausedAtLimit } from './isAutoPausedAtLimit';
import { isAutoPlanAwaitingApproval } from './isAutoPlanAwaitingApproval';
import { NAMES } from '../../shared/utils/names';

type AutoRetryTargetKind = AutoStuckKind | 'approve' | 'blocked';

export type AutoPlanFacts = Readonly<{
  name: string;
  version: number;
  branchCount: number;
}>;

export type AutoRetryTarget = Readonly<{
  agentId: AgentId;
  rootAgentId: AgentId;
  role: string;
  noun: string;
  kind: AutoRetryTargetKind;
  reason: string | null;
  reasonCode: string | null;
  mountId: string | null;
  plan: AutoPlanFacts | null;
  canRetry: boolean;
}>;

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly agents: ReadonlyArray<Agent>;
  readonly now: number;
  readonly settledAt?: number | null;
};

type ChildParams = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly agents: ReadonlyArray<Agent>;
  readonly rootAgentId: AgentId;
  readonly child: AutoGroupChild;
  readonly settledAt: number | null;
};

const targetOfChild = ({
  views,
  agents,
  rootAgentId,
  child,
  settledAt,
}: ChildParams): AutoRetryTarget | null => {
  const kind = autoStuckKindOf({ state: child.state });
  if (kind === null || child.isGone === true) {
    return null;
  }
  const failedAt = child.finishedAt ?? child.startedAt ?? child.createdAt;
  if (failedAt !== null && isFailureSettled({ at: failedAt, settledAt })) {
    return null;
  }
  return {
    agentId: child.agentId,
    rootAgentId,
    role: child.label,
    noun: child.noun,
    kind,
    reason: child.reason,
    reasonCode: child.reasonCode,
    mountId: child.mountId,
    plan: null,
    canRetry: autoRetryRouteOf({ views, runs: agents, agentId: child.agentId }) !== null,
  };
};

type ViewParams = {
  readonly view: AutoTreeView;
};

const planOf = ({ view }: ViewParams): AutoPlanFacts | null => {
  const plan = dockPlanOf({ view });
  if (plan?.kind !== 'waiting' || plan.row.title.trim() === '') {
    return null;
  }
  const branches = new Set(
    view.delegations.flatMap((delegation) => {
      const mountId = textField({ source: delegation.target, key: 'mountId' });
      return mountId === null ? [] : [mountId];
    }),
  );
  return { name: plan.row.title.trim(), version: plan.version, branchCount: branches.size };
};

type OwnParams = ViewParams & {
  readonly kind: 'approve' | 'blocked';
};

const ownTargetOf = ({ view, kind }: OwnParams): AutoRetryTarget => ({
  agentId: view.tree.rootAgentId,
  rootAgentId: view.tree.rootAgentId,
  role: NAMES.lead,
  noun: NAMES.lead,
  kind,
  reason: null,
  reasonCode: null,
  mountId: null,
  plan: kind === 'approve' ? planOf({ view }) : null,
  canRetry: false,
});

export const autoRetryTargetsOf = ({
  views,
  agents,
  now,
  settledAt = null,
}: Params): ReadonlyArray<AutoRetryTarget> =>
  views.flatMap((view) => {
    const phase = view.tree.phase;
    if (phase === 'finished' || phase === 'stopped') {
      return [];
    }
    const rootAgentId = view.tree.rootAgentId;
    if (!agents.some((agent) => agent.id === rootAgentId)) {
      return [];
    }
    const group = autoGroupOf({ view, agents, now });
    const children = (group?.children ?? []).flatMap((child) => {
      const target = targetOfChild({ views, agents, rootAgentId, child, settledAt });
      return target === null ? [] : [target];
    });
    return [
      ...children,
      ...(isAutoPlanAwaitingApproval({ view }) ? [ownTargetOf({ view, kind: 'approve' })] : []),
      ...(phase === 'blocked' && !isAutoPausedAtLimit({ view })
        ? [ownTargetOf({ view, kind: 'blocked' })]
        : []),
    ];
  });
