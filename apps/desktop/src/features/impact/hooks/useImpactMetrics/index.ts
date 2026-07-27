import { useEffect, useState } from 'react';
import {
  getContextHealth,
  getDelegationFlow,
  getModelMix,
  getOrchestrationOverview,
  getPlanAdoption,
  getRightSizeNudgeOutcomes,
  getTurnDistribution,
  type ContextHealth,
  type DelegationFlow,
  type ModelMixEntry,
  type NudgeOutcomeCount,
  type OrchestrationOverview,
  type PlanAdoption,
  type TurnBucket,
} from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { IMPACT_WINDOW_DAYS, type ImpactWindowId } from '../../lib';

const DAY_MS = 86_400_000;

const EMPTY_OVERVIEW: OrchestrationOverview = {
  sessionCount: 0,
  orchestratedSessions: 0,
  plannedSessions: 0,
  workflowSessions: 0,
  splitSessions: 0,
  resolverSessions: 0,
};

const EMPTY_PLAN: PlanAdoption = {
  sessionCount: 0,
  plannedSessions: 0,
  consumedPlans: 0,
  handoffPlans: 0,
  handoffSessions: 0,
};

const EMPTY_CONTEXT: ContextHealth = {
  sessionCount: 0,
  slotSessions: 0,
  userEdits: 0,
  summarizerEdits: 0,
  questionsTotal: 0,
  questionsAnswered: 0,
  questionsDismissed: 0,
  avgHoursToAnswer: null,
};

const EMPTY_DELEGATION: DelegationFlow = {
  sessionCount: 0,
  workflowRuns: 0,
  workflowSessions: 0,
  discardedRuns: 0,
  scoutChildren: 0,
  clusterChildren: 0,
  completedGroups: 0,
  longAgents: 0,
  resolverAgents: 0,
  resolvedThreads: 0,
  diffCommentsTotal: 0,
  diffCommentsHandled: 0,
  linkedSessions: 0,
  startedFromSessions: 0,
  integrationCount: 0,
  external: [],
};

export type ImpactMetrics = {
  readonly overview: OrchestrationOverview | null;
  readonly allTimeOverview: OrchestrationOverview | null;
  readonly plan: PlanAdoption | null;
  readonly context: ContextHealth | null;
  readonly turns: ReadonlyArray<TurnBucket> | null;
  readonly mix: ReadonlyArray<ModelMixEntry> | null;
  readonly nudges: ReadonlyArray<NudgeOutcomeCount> | null;
  readonly delegation: DelegationFlow | null;
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly windowId: ImpactWindowId;
};

export const useImpactMetrics = ({ workspaceId, windowId }: Params): ImpactMetrics => {
  const [overview, setOverview] = useState<OrchestrationOverview | null>(null);
  const [allTimeOverview, setAllTimeOverview] = useState<OrchestrationOverview | null>(null);
  const [plan, setPlan] = useState<PlanAdoption | null>(null);
  const [context, setContext] = useState<ContextHealth | null>(null);
  const [turns, setTurns] = useState<ReadonlyArray<TurnBucket> | null>(null);
  const [mix, setMix] = useState<ReadonlyArray<ModelMixEntry> | null>(null);
  const [nudges, setNudges] = useState<ReadonlyArray<NudgeOutcomeCount> | null>(null);
  const [delegation, setDelegation] = useState<DelegationFlow | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sinceMs = windowId === 'all' ? null : Date.now() - IMPACT_WINDOW_DAYS * DAY_MS;
    const params = { workspaceId, sinceMs };

    setOverview(null);
    setAllTimeOverview(null);
    setPlan(null);
    setContext(null);
    setTurns(null);
    setMix(null);
    setNudges(null);
    setDelegation(null);

    void getOrchestrationOverview(tauriDatabase, params)
      .then(async (value) => {
        if (cancelled) {
          return;
        }
        setOverview(value);
        if (value.sessionCount > 0 || sinceMs === null) {
          setAllTimeOverview(value);
          return;
        }
        const allTime = await getOrchestrationOverview(tauriDatabase, {
          workspaceId,
          sinceMs: null,
        });
        if (cancelled) {
          return;
        }
        setAllTimeOverview(allTime);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setOverview(EMPTY_OVERVIEW);
        setAllTimeOverview(EMPTY_OVERVIEW);
      });

    void getPlanAdoption(tauriDatabase, params)
      .then((value) => {
        if (cancelled) {
          return;
        }
        setPlan(value);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setPlan(EMPTY_PLAN);
      });

    void getContextHealth(tauriDatabase, params)
      .then((value) => {
        if (cancelled) {
          return;
        }
        setContext(value);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setContext(EMPTY_CONTEXT);
      });

    void getTurnDistribution(tauriDatabase, params)
      .then((value) => {
        if (cancelled) {
          return;
        }
        setTurns(value);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setTurns([]);
      });

    void getModelMix(tauriDatabase, params)
      .then((value) => {
        if (cancelled) {
          return;
        }
        setMix(value);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setMix([]);
      });

    void getRightSizeNudgeOutcomes(tauriDatabase, params)
      .then((value) => {
        if (cancelled) {
          return;
        }
        setNudges(value);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setNudges([]);
      });

    void getDelegationFlow(tauriDatabase, params)
      .then((value) => {
        if (cancelled) {
          return;
        }
        setDelegation(value);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setDelegation(EMPTY_DELEGATION);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, windowId]);

  return { overview, allTimeOverview, plan, context, turns, mix, nudges, delegation };
};
