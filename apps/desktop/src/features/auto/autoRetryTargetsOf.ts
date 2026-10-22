import type { Agent, AgentId } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { autoRetryRouteOf } from '../../store/slices/turn/autoRetryRouteOf';
import { autoGroupOf, type AutoGroupChild } from './autoGroupOf';
import { autoStuckKindOf, type AutoStuckKind } from './autoStuckKindOf';
import { textField } from './chat/readJson';
import { isAutoPlanAwaitingApproval } from './isAutoPlanAwaitingApproval';

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
  const kind = autoStuckKindOf({ state: child.state });
  if (kind === null) {
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
  const row = view.artifacts.find(
    (candidate) =>
      candidate.artifact.kind === 'plan' &&
      candidate.artifact.approvalState === 'needs_approval' &&
      candidate.artifact.openReviseDelegationId === null,
  );
  if (row === undefined || row.title.trim() === '') {
    return null;
  }
  const branches = new Set(
    view.delegations.flatMap((delegation) => {
      const mountId = textField({ source: delegation.target, key: 'mountId' });
      return mountId === null ? [] : [mountId];
    }),
  );
  return { name: row.title.trim(), version: row.revision, branchCount: branches.size };
};

type OwnParams = ViewParams & {
  readonly kind: 'approve' | 'blocked';
};

const ownTargetOf = ({ view, kind }: OwnParams): AutoRetryTarget => ({
  agentId: view.tree.rootAgentId,
  rootAgentId: view.tree.rootAgentId,
  role: 'Auto',
  noun: 'Auto',
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
      ...(isAutoPlanAwaitingApproval({ view }) ? [ownTargetOf({ view, kind: 'approve' })] : []),
      ...(phase === 'blocked' ? [ownTargetOf({ view, kind: 'blocked' })] : []),
    ];
  });
