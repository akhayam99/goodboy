import { useCallback, useEffect, useState } from 'react';
import type { SessionId, TelemetryRecord, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { tauriDatabase } from '../../../shared/lib/db';
import { limitTiersOf, monthTiersOf } from '../../budget/limitTiersOf';
import { pausingSessionCapOf } from '../../budget/pausingSessionCapOf';
import { sumSessionCost } from '../../../store/slices/sessions/sumSessionCost';
import { autoLimitOf } from '../autoLimitOf';
import { parseAutoTreeLimit, writeAutoTreeLimit } from '../autoTreeLimit';
import { startLimitOf, type StartLimit } from '../startLimitOf';
import type { LimitDefaultParams } from '../limitDefaultFrom';
import { runDefaultLimitOf } from '../../../store/slices/workflows/runLimit/runDefaultLimitOf';

type Params = {
  readonly workspaceId: WorkspaceId | null;
  readonly sessionId?: SessionId | null;
};

type Draft = Readonly<{ usd: number | null }>;

export type AutoTreeLimitView = Readonly<{
  usd: number | null;
  isFromSession: boolean;
  isDefault: boolean;
  defaultUsd: number | null;
  isStored: boolean;
  tiers: string;
  change: (usd: number | null) => void;
}>;

export type AutoTreeLimitModel = Readonly<{
  viewOf: (params: LimitDefaultParams) => AutoTreeLimitView;
  persist: (params: LimitDefaultParams) => Promise<StartLimit>;
}>;

const NO_RECORDS: ReadonlyArray<TelemetryRecord> = [];

export const useAutoTreeLimit = ({ workspaceId, sessionId = null }: Params): AutoTreeLimitModel => {
  const raw = useAppStore((state) =>
    workspaceId === null ? undefined : state.workspaceValues[workspaceId]?.['auto.treeLimitUsd'],
  );
  const sessionCapUsd = useAppStore((state) =>
    sessionId === null ? null : pausingSessionCapOf({ budget: state.sessionBudgets[sessionId] }),
  );
  const sessionSpentUsd = useAppStore((state) =>
    sessionId === null ? null : sumSessionCost(state.sessionTelemetry[sessionId] ?? NO_RECORDS),
  );
  const statuses = useAppStore((state) => state.providerBudgetStatus);
  const loadWorkspaceValue = useAppStore((state) => state.loadWorkspaceValue);
  const reportError = useAppStore((state) => state.reportError);
  const [draft, setDraft] = useState<Draft | null>(null);
  const storedUsd = parseAutoTreeLimit({ raw });

  useEffect(() => {
    if (workspaceId === null) {
      return;
    }
    loadWorkspaceValue({ workspaceId, key: 'auto.treeLimitUsd' }).catch((error: unknown) => {
      void reportError({ title: "Couldn't read the Auto limit", error });
    });
  }, [workspaceId, loadWorkspaceValue, reportError]);

  const runDefaultUsd = useAppStore((state) =>
    workspaceId === null ? null : runDefaultLimitOf({ state, workspaceId }),
  );
  const tiers = limitTiersOf({
    session: { capUsd: sessionCapUsd, spentUsd: sessionSpentUsd },
    months: monthTiersOf({ statuses }),
  });
  const draftUsd = draft === null ? undefined : draft.usd;

  const factsOf = useCallback(
    ({ defaultFrom }: LimitDefaultParams) =>
      autoLimitOf({
        storedUsd: defaultFrom === 'run' ? runDefaultUsd : storedUsd,
        draftUsd,
        sessionCapUsd,
      }),
    [draftUsd, runDefaultUsd, sessionCapUsd, storedUsd],
  );

  const change = useCallback((next: number | null): void => setDraft({ usd: next }), []);

  const viewOf = useCallback(
    ({ defaultFrom }: LimitDefaultParams): AutoTreeLimitView => {
      const facts = factsOf({ defaultFrom });
      return {
        usd: facts.usd,
        isFromSession: facts.isFromSession,
        isDefault: facts.isDefault,
        defaultUsd: facts.defaultUsd,
        isStored: defaultFrom === 'run' ? runDefaultUsd !== null : storedUsd !== null,
        tiers,
        change,
      };
    },
    [change, factsOf, runDefaultUsd, storedUsd, tiers],
  );

  const persist = useCallback(
    async ({ defaultFrom }: LimitDefaultParams): Promise<StartLimit> => {
      const facts = factsOf({ defaultFrom });
      const shownLimit = startLimitOf({ facts });
      if (workspaceId === null || facts.isFromSession || draft === null) {
        return shownLimit;
      }
      if (defaultFrom === 'run' || draft.usd === storedUsd) {
        setDraft(null);
        return shownLimit;
      }
      await writeAutoTreeLimit({ db: tauriDatabase, workspaceId, usd: draft.usd });
      await loadWorkspaceValue({ workspaceId, key: 'auto.treeLimitUsd' });
      setDraft(null);
      return shownLimit;
    },
    [draft, factsOf, loadWorkspaceValue, storedUsd, workspaceId],
  );

  return { viewOf, persist };
};
