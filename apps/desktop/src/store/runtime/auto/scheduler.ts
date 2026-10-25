import { AUTO_OWNER_LEASE_MS } from '@goodboy/core';
import {
  casAutoTreePhase,
  claimAutoTree,
  insertAutoTree,
  releaseAutoTree,
  type AutoPhase,
  type AutoTreeExpectation,
  type AutoTreePhaseOutcome,
  type AutoTreePhasePatch,
  type Database,
  type InsertAutoTreeOutcome,
  type NewAutoTree,
} from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { admitBatch, type AdmitBatchParams, type AdmitOutcome } from './admit';
import { failRevise, type FailReviseOutcome, type FailReviseParams } from './failRevise';
import { landRevision, type LandRevisionOutcome, type LandRevisionParams } from './landRevision';
import { markAttemptRunning, type MarkAttemptRunningParams } from './markAttemptRunning';
import {
  settleAttempt,
  type SettleAttemptOutcome,
  type SettleAttemptParams,
} from './settleAttempt';
import { startAttempt, type StartAttemptOutcome, type StartAttemptParams } from './startAttempt';
import { treeBudget, type TreeBudget } from './treeBudget';

type WithoutContext<Params> = Omit<Params, 'db' | 'ownerId' | 'nowMs'>;

export type SchedulerParams = Readonly<{
  db: Database;
  ownerId: string;
  now: () => number;
}>;

type TransitionParams = Readonly<{
  treeId: AutoTreeId;
  expect: AutoTreeExpectation;
  to: AutoPhase;
  patch?: AutoTreePhasePatch;
}>;

type TreeOnlyParams = Readonly<{
  treeId: AutoTreeId;
}>;

export type AutoScheduler = Readonly<{
  ownerId: string;
  createTree: (params: Omit<NewAutoTree, 'nowMs'>) => Promise<InsertAutoTreeOutcome>;
  claim: (params: TreeOnlyParams) => Promise<boolean>;
  release: (params: TreeOnlyParams) => Promise<boolean>;
  transition: (params: TransitionParams) => Promise<AutoTreePhaseOutcome>;
  admit: (params: WithoutContext<AdmitBatchParams>) => Promise<AdmitOutcome>;
  startAttempt: (params: WithoutContext<StartAttemptParams>) => Promise<StartAttemptOutcome>;
  markAttemptRunning: (
    params: Omit<MarkAttemptRunningParams, 'db'>,
  ) => ReturnType<typeof markAttemptRunning>;
  settleAttempt: (params: WithoutContext<SettleAttemptParams>) => Promise<SettleAttemptOutcome>;
  landRevision: (params: WithoutContext<LandRevisionParams>) => Promise<LandRevisionOutcome>;
  failRevise: (params: WithoutContext<FailReviseParams>) => Promise<FailReviseOutcome>;
  budget: (params: TreeOnlyParams) => Promise<TreeBudget | null>;
}>;

export const createAutoScheduler = ({ db, ownerId, now }: SchedulerParams): AutoScheduler => ({
  ownerId,
  createTree: (tree) => insertAutoTree({ db, tree: { ...tree, nowMs: now() } }),
  claim: ({ treeId }) =>
    claimAutoTree({ db, treeId, ownerId, nowMs: now(), leaseMs: AUTO_OWNER_LEASE_MS }),
  release: ({ treeId }) => releaseAutoTree({ db, treeId, ownerId }),
  transition: ({ treeId, expect, to, patch }) =>
    casAutoTreePhase({ db, treeId, ownerId, nowMs: now(), expect, to, patch }),
  admit: (params) => admitBatch({ ...params, db, ownerId, nowMs: now() }),
  startAttempt: (params) => startAttempt({ ...params, db, ownerId, nowMs: now() }),
  markAttemptRunning: (params) => markAttemptRunning({ ...params, db }),
  settleAttempt: (params) => settleAttempt({ ...params, db, ownerId, nowMs: now() }),
  landRevision: (params) => landRevision({ ...params, db, ownerId, nowMs: now() }),
  failRevise: (params) => failRevise({ ...params, db, ownerId, nowMs: now() }),
  budget: ({ treeId }) => treeBudget({ db, treeId }),
});
