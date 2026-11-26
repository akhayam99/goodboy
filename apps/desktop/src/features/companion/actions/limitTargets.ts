import type { Session, SessionBudget, WorkflowSpendLimitMode } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';

export type LimitKind = 'run' | 'tree' | 'session';

export type LimitScope = {
  readonly sessions: ReadonlyArray<Session>;
  readonly trees: Readonly<Record<string, ReadonlyArray<AutoTreeView> | undefined>>;
  readonly budgets: Readonly<Record<string, SessionBudget | undefined>>;
};

export type LimitTarget = {
  readonly kind: LimitKind;
  readonly limit: number;
  readonly mode: WorkflowSpendLimitMode;
  readonly onExceed: SessionBudget['onExceed'];
};

type KindParams = {
  readonly scope: LimitScope;
  readonly sessionId: string;
  readonly runId: string;
  readonly kind: LimitKind;
};

export const limitOfKind = ({ scope, sessionId, runId, kind }: KindParams): LimitTarget | null => {
  const budget = scope.budgets[sessionId];
  const onExceed = budget?.onExceed ?? 'pause';
  if (kind === 'session') {
    return budget === undefined
      ? null
      : { kind, limit: budget.softCapUsd, mode: 'pause', onExceed };
  }
  if (kind === 'run') {
    const run = sessionById(scope.sessions, sessionId)?.workflowRuns.find(
      (candidate) => candidate.id === runId && candidate.discardedAt == null,
    );
    return run?.spendLimitUsd == null
      ? null
      : { kind, limit: run.spendLimitUsd, mode: run.spendLimitMode ?? 'pause', onExceed };
  }
  const tree = (scope.trees[sessionId] ?? []).find((view) => view.tree.id === runId);
  return tree?.tree.capUsd == null
    ? null
    : { kind, limit: tree.tree.capUsd, mode: 'pause', onExceed };
};

type TargetParams = {
  readonly scope: LimitScope;
  readonly sessionId: string;
  readonly runId: string;
};

const KINDS: ReadonlyArray<LimitKind> = ['run', 'tree', 'session'];

export const limitTargetOf = ({ scope, sessionId, runId }: TargetParams): LimitTarget | null => {
  const isKnownRun =
    sessionById(scope.sessions, sessionId)?.workflowRuns.some((run) => run.id === runId) === true ||
    (scope.trees[sessionId] ?? []).some((view) => view.tree.id === runId);
  if (!isKnownRun) {
    return null;
  }
  const found = KINDS.map((kind) => limitOfKind({ scope, sessionId, runId, kind })).filter(
    (target): target is LimitTarget => target !== null,
  );
  return found.reduce<LimitTarget | null>(
    (lowest, target) => (lowest === null || target.limit < lowest.limit ? target : lowest),
    null,
  );
};

type StoreParams = {
  readonly store: AppStore;
};

export const limitScopeOfStore = ({ store }: StoreParams): LimitScope => ({
  sessions: store.sessions,
  trees: store.autoTreeViews ?? {},
  budgets: store.sessionBudgets,
});
