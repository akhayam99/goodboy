import { parseAutoDelegationRole } from '@goodboy/core/auto';
import type { AutoArtifactLedgerRow, AutoDelegation } from '@goodboy/db';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { delegationClosedOf } from './delegationClosedOf';
import { delegationReasonTextOf } from './delegationReasonTextOf';
import { planAwaitsYou } from './planAwaitsYou';
import { planKeptBaseOf } from './planKeptBaseOf';
import { planLineOf, type PlanLineEntry } from './planLineOf';

type Shared = Readonly<{
  row: AutoArtifactLedgerRow;
  version: number;
}>;

export type DockPlan =
  | (Shared & Readonly<{ kind: 'waiting' }>)
  | (Shared &
      Readonly<{ kind: 'updating'; by: 'lead' | 'planner'; planner: AutoDelegation | null }>)
  | (Shared & Readonly<{ kind: 'failed'; planner: AutoDelegation; reason: string | null }>)
  | (Shared & Readonly<{ kind: 'settled' }>);

type Params = {
  readonly view: AutoTreeView;
};

type EntryParams = Params & {
  readonly entry: PlanLineEntry;
};

const FAILED_OUTCOMES: ReadonlySet<AutoDelegation['outcome']> = new Set([
  'failed',
  'timed_out',
  'blocked',
]);

type AttemptParams = {
  readonly entry: PlanLineEntry;
  readonly delegation: AutoDelegation;
};

const isAttemptFor = ({ entry, delegation }: AttemptParams): boolean => {
  const artifact = entry.row.artifact;
  if (delegationClosedOf({ delegation }) !== null) {
    return false;
  }
  if (delegation.reviseOf !== null) {
    return (
      delegation.reviseOf === artifact.artifactId && delegation.baseRevision === entry.row.revision
    );
  }
  return (
    delegation.id !== artifact.ownerDelegationId &&
    parseAutoDelegationRole({ role: delegation.role }) === 'planner' &&
    delegation.createdAt > entry.row.updatedAt
  );
};

const latestAttemptOf = ({ view, entry }: EntryParams): AutoDelegation | null =>
  view.delegations
    .filter((delegation) => isAttemptFor({ entry, delegation }))
    .sort((first, second) => second.createdAt - first.createdAt)[0] ?? null;

const stateOf = ({ view, entry }: EntryParams): DockPlan => {
  const { row, version } = entry;
  const shared = { row, version };
  if (row.status !== 'active') {
    return { ...shared, kind: 'settled' };
  }
  const attempt = latestAttemptOf({ view, entry });
  const open = row.artifact.openReviseDelegationId;
  const openPlanner =
    open === null ? null : (view.delegations.find((delegation) => delegation.id === open) ?? null);
  if (open !== null && openPlanner?.state !== 'awaiting_confirm') {
    return { ...shared, kind: 'updating', by: 'planner', planner: openPlanner };
  }
  if (attempt !== null && attempt.state !== 'settled' && attempt.state !== 'awaiting_confirm') {
    return { ...shared, kind: 'updating', by: 'planner', planner: attempt };
  }
  const sent = view.sentChange ?? null;
  if (
    sent !== null &&
    sent.artifactId === row.artifact.artifactId &&
    sent.revision === row.revision
  ) {
    return { ...shared, kind: 'updating', by: 'lead', planner: null };
  }
  if (
    attempt !== null &&
    FAILED_OUTCOMES.has(attempt.outcome) &&
    planKeptBaseOf({ delegation: attempt }) !== row.revision
  ) {
    return {
      ...shared,
      kind: 'failed',
      planner: attempt,
      reason: delegationReasonTextOf({ reason: attempt.reason }),
    };
  }
  if (planAwaitsYou({ row, level: view.level })) {
    return { ...shared, kind: 'waiting' };
  }
  return { ...shared, kind: 'settled' };
};

export const dockPlanOf = ({ view }: Params): DockPlan | null => {
  const plans = planLineOf({ view })
    .filter((entry) => !entry.isSuperseded)
    .map((entry) => stateOf({ view, entry }));
  return plans.find((plan) => plan.kind !== 'settled') ?? plans[0] ?? null;
};
