import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { QueryResult } from '../../../../shared/types/queryResult';

type BudgetDataScope = 'rules' | 'alerts' | 'telemetry' | 'sessionBudgets';

export type BudgetData = {
  readonly rules: QueryResult<void>;
  readonly alerts: QueryResult<void>;
  readonly telemetry: QueryResult<void>;
  readonly sessionBudgets: QueryResult<void>;
  readonly loading: Readonly<Record<BudgetDataScope, boolean>>;
  readonly retry: (scope: BudgetDataScope) => void;
};

type Params = {
  readonly sessionIds: ReadonlyArray<SessionId>;
};

type LoadQueryParams = {
  readonly query: () => Promise<void>;
  readonly setResult: (result: QueryResult<void>) => void;
  readonly activeGeneration: number;
};

type LoadScopeParams = {
  readonly scope: BudgetDataScope;
  readonly activeGeneration: number;
};

type ToErrorParams = {
  readonly value: unknown;
};

const EMPTY_LOADING = {
  rules: true,
  alerts: true,
  telemetry: true,
  sessionBudgets: true,
} satisfies Record<BudgetDataScope, boolean>;

const EMPTY_RESULT = { data: null, error: null };

const toError = ({ value }: ToErrorParams): Error =>
  value instanceof Error ? value : new Error(String(value));

export const useBudgetData = ({ sessionIds }: Params): BudgetData => {
  const generation = useRef(0);
  const loadBudgetRules = useAppStore((state) => state.loadBudgetRules);
  const loadBudgetAlerts = useAppStore((state) => state.loadBudgetAlerts);
  const loadSessionTelemetry = useAppStore((state) => state.loadSessionTelemetry);
  const loadSessionBudget = useAppStore((state) => state.loadSessionBudget);
  const [rules, setRules] = useState<QueryResult<void>>(EMPTY_RESULT);
  const [alerts, setAlerts] = useState<QueryResult<void>>(EMPTY_RESULT);
  const [telemetry, setTelemetry] = useState<QueryResult<void>>(EMPTY_RESULT);
  const [sessionBudgets, setSessionBudgets] = useState<QueryResult<void>>(EMPTY_RESULT);
  const [loading, setLoading] = useState<Readonly<Record<BudgetDataScope, boolean>>>(EMPTY_LOADING);

  const loadQuery = useCallback(async ({ query, setResult, activeGeneration }: LoadQueryParams) => {
    try {
      await query();
      if (generation.current !== activeGeneration) {
        return;
      }

      setResult({ data: undefined, error: null });
    } catch (value) {
      if (generation.current !== activeGeneration) {
        return;
      }

      setResult({ data: null, error: toError({ value }) });
    }
  }, []);

  const loadScope = useCallback(
    async ({ scope, activeGeneration }: LoadScopeParams) => {
      setLoading((current) => ({ ...current, [scope]: true }));
      if (scope === 'rules') {
        setRules(EMPTY_RESULT);
        await loadQuery({ query: loadBudgetRules, setResult: setRules, activeGeneration });
      }
      if (scope === 'alerts') {
        setAlerts(EMPTY_RESULT);
        await loadQuery({ query: loadBudgetAlerts, setResult: setAlerts, activeGeneration });
      }
      if (scope === 'telemetry') {
        setTelemetry(EMPTY_RESULT);
        await loadQuery({
          query: async () => {
            await Promise.all(sessionIds.map((sessionId) => loadSessionTelemetry(sessionId)));
          },
          setResult: setTelemetry,
          activeGeneration,
        });
      }
      if (scope === 'sessionBudgets') {
        setSessionBudgets(EMPTY_RESULT);
        await loadQuery({
          query: async () => {
            await Promise.all(sessionIds.map((sessionId) => loadSessionBudget(sessionId)));
          },
          setResult: setSessionBudgets,
          activeGeneration,
        });
      }
      if (generation.current !== activeGeneration) {
        return;
      }

      setLoading((current) => ({ ...current, [scope]: false }));
    },
    [
      loadBudgetAlerts,
      loadBudgetRules,
      loadQuery,
      loadSessionBudget,
      loadSessionTelemetry,
      sessionIds,
    ],
  );

  useEffect(() => {
    generation.current += 1;
    const activeGeneration = generation.current;
    setLoading(EMPTY_LOADING);
    void Promise.all(
      (
        ['rules', 'alerts', 'telemetry', 'sessionBudgets'] satisfies ReadonlyArray<BudgetDataScope>
      ).map((scope) => loadScope({ scope, activeGeneration })),
    );

    return () => {
      generation.current += 1;
    };
  }, [loadScope]);

  const retry = useCallback(
    (scope: BudgetDataScope) => {
      void loadScope({ scope, activeGeneration: generation.current });
    },
    [loadScope],
  );

  return { rules, alerts, telemetry, sessionBudgets, loading, retry };
};
