import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAgentDurations,
  getCacheEfficiency,
  getContextGrowth,
  getExternalTaskOutcomes,
  getFlowHealth,
  getImpactOverview,
  getPullRequestOutcomes,
  getReviewOutcomes,
  getRightSizeNudgeOutcomes,
  getTurnDistribution,
  type AgentDurations,
  type CacheEfficiencyEntry,
  type ContextGrowthPoint,
  type ExternalTaskOutcomes,
  type FlowHealth,
  type ImpactOverview,
  type NudgeOutcomeCount,
  type PullRequestOutcomes,
  type ReviewOutcomes,
  type TurnBucket,
} from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { IMPACT_WINDOW_DAYS, type ImpactScopeId, type ImpactWindowId } from '../../lib';

const DAY_MS = 86_400_000;

export type ImpactMetrics = {
  readonly overview: QueryResult<ImpactOverview>;
  readonly pullRequests: QueryResult<PullRequestOutcomes>;
  readonly reviews: QueryResult<ReviewOutcomes>;
  readonly externalTasks: QueryResult<ExternalTaskOutcomes>;
  readonly agentDurations: QueryResult<AgentDurations>;
  readonly flowHealth: QueryResult<FlowHealth>;
  readonly cacheEfficiency: QueryResult<ReadonlyArray<CacheEfficiencyEntry>>;
  readonly contextGrowth: QueryResult<ReadonlyArray<ContextGrowthPoint>>;
  readonly turns: QueryResult<ReadonlyArray<TurnBucket>>;
  readonly nudges: QueryResult<ReadonlyArray<NudgeOutcomeCount>>;
  readonly loading: Readonly<Record<ImpactScopeId, boolean>>;
  readonly retry: (scope: ImpactScopeId) => void;
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly windowId: ImpactWindowId;
};

type LoadQueryParams<T> = {
  readonly query: () => Promise<T>;
  readonly setResult: (result: QueryResult<T>) => void;
  readonly activeGeneration: number;
};

type LoadScopeParams = {
  readonly scope: ImpactScopeId;
  readonly activeGeneration: number;
};

type ToErrorParams = {
  readonly value: unknown;
};

const EMPTY_LOADING = {
  overview: true,
  shipped: true,
  flow: true,
  efficiency: true,
} satisfies Record<ImpactScopeId, boolean>;

const EMPTY_RESULT = { data: null, error: null };

const toError = ({ value }: ToErrorParams): Error =>
  value instanceof Error ? value : new Error(String(value));

export const useImpactMetrics = ({ workspaceId, windowId }: Params): ImpactMetrics => {
  const generation = useRef(0);
  const [overview, setOverview] = useState<QueryResult<ImpactOverview>>(EMPTY_RESULT);
  const [pullRequests, setPullRequests] = useState<QueryResult<PullRequestOutcomes>>(EMPTY_RESULT);
  const [reviews, setReviews] = useState<QueryResult<ReviewOutcomes>>(EMPTY_RESULT);
  const [externalTasks, setExternalTasks] =
    useState<QueryResult<ExternalTaskOutcomes>>(EMPTY_RESULT);
  const [agentDurations, setAgentDurations] = useState<QueryResult<AgentDurations>>(EMPTY_RESULT);
  const [flowHealth, setFlowHealth] = useState<QueryResult<FlowHealth>>(EMPTY_RESULT);
  const [cacheEfficiency, setCacheEfficiency] =
    useState<QueryResult<ReadonlyArray<CacheEfficiencyEntry>>>(EMPTY_RESULT);
  const [contextGrowth, setContextGrowth] =
    useState<QueryResult<ReadonlyArray<ContextGrowthPoint>>>(EMPTY_RESULT);
  const [turns, setTurns] = useState<QueryResult<ReadonlyArray<TurnBucket>>>(EMPTY_RESULT);
  const [nudges, setNudges] = useState<QueryResult<ReadonlyArray<NudgeOutcomeCount>>>(EMPTY_RESULT);
  const [loading, setLoading] = useState<Readonly<Record<ImpactScopeId, boolean>>>(EMPTY_LOADING);

  const params = useMemo(
    () => ({
      db: tauriDatabase,
      workspaceId,
      sinceMs: windowId === 'all' ? null : Date.now() - IMPACT_WINDOW_DAYS * DAY_MS,
    }),
    [windowId, workspaceId],
  );

  const loadQuery = useCallback(
    async <T>({ query, setResult, activeGeneration }: LoadQueryParams<T>) => {
      try {
        const data = await query();
        if (generation.current !== activeGeneration) {
          return;
        }
        setResult({ data, error: null });
      } catch (value) {
        if (generation.current !== activeGeneration) {
          return;
        }
        setResult({ data: null, error: toError({ value }) });
      }
    },
    [],
  );

  const loadScope = useCallback(
    async ({ scope, activeGeneration }: LoadScopeParams) => {
      setLoading((current) => ({ ...current, [scope]: true }));
      if (scope === 'overview') {
        setOverview(EMPTY_RESULT);
        await loadQuery({
          query: () => getImpactOverview(params),
          setResult: setOverview,
          activeGeneration,
        });
      }
      if (scope === 'shipped') {
        setPullRequests(EMPTY_RESULT);
        setReviews(EMPTY_RESULT);
        setExternalTasks(EMPTY_RESULT);
        await Promise.all([
          loadQuery({
            query: () => getPullRequestOutcomes(params),
            setResult: setPullRequests,
            activeGeneration,
          }),
          loadQuery({
            query: () => getReviewOutcomes(params),
            setResult: setReviews,
            activeGeneration,
          }),
          loadQuery({
            query: () => getExternalTaskOutcomes(params),
            setResult: setExternalTasks,
            activeGeneration,
          }),
        ]);
      }
      if (scope === 'flow') {
        setAgentDurations(EMPTY_RESULT);
        setFlowHealth(EMPTY_RESULT);
        await Promise.all([
          loadQuery({
            query: () => getAgentDurations(params),
            setResult: setAgentDurations,
            activeGeneration,
          }),
          loadQuery({
            query: () => getFlowHealth(params),
            setResult: setFlowHealth,
            activeGeneration,
          }),
        ]);
      }
      if (scope === 'efficiency') {
        setCacheEfficiency(EMPTY_RESULT);
        setContextGrowth(EMPTY_RESULT);
        setTurns(EMPTY_RESULT);
        setNudges(EMPTY_RESULT);
        await Promise.all([
          loadQuery({
            query: () => getCacheEfficiency(params),
            setResult: setCacheEfficiency,
            activeGeneration,
          }),
          loadQuery({
            query: () => getContextGrowth(params),
            setResult: setContextGrowth,
            activeGeneration,
          }),
          loadQuery({
            query: () => getTurnDistribution(params),
            setResult: setTurns,
            activeGeneration,
          }),
          loadQuery({
            query: () => getRightSizeNudgeOutcomes(params),
            setResult: setNudges,
            activeGeneration,
          }),
        ]);
      }
      if (generation.current !== activeGeneration) {
        return;
      }
      setLoading((current) => ({ ...current, [scope]: false }));
    },
    [loadQuery, params],
  );

  useEffect(() => {
    generation.current += 1;
    const activeGeneration = generation.current;
    setLoading(EMPTY_LOADING);
    void Promise.all(
      (['overview', 'shipped', 'flow', 'efficiency'] satisfies ReadonlyArray<ImpactScopeId>).map(
        (scope) => loadScope({ scope, activeGeneration }),
      ),
    );
    return () => {
      generation.current += 1;
    };
  }, [loadScope]);

  const retry = useCallback(
    (scope: ImpactScopeId) => {
      void loadScope({ scope, activeGeneration: generation.current });
    },
    [loadScope],
  );

  return {
    overview,
    pullRequests,
    reviews,
    externalTasks,
    agentDurations,
    flowHealth,
    cacheEfficiency,
    contextGrowth,
    turns,
    nudges,
    loading,
    retry,
  };
};
