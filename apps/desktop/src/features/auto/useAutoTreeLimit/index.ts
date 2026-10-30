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

type Params = {
  readonly workspaceId: WorkspaceId | null;
  readonly sessionId?: SessionId | null;
};

type Draft = Readonly<{ usd: number | null }>;

export type AutoTreeLimitModel = Readonly<{
  usd: number | null;
  isFromSession: boolean;
  isDefault: boolean;
  defaultUsd: number | null;
  isStored: boolean;
  tiers: string;
  change: (usd: number | null) => void;
  persist: () => Promise<StartLimit>;
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

  const facts = autoLimitOf({
    storedUsd,
    draftUsd: draft === null ? undefined : draft.usd,
    sessionCapUsd,
  });
  const { isFromSession } = facts;
  const shown = startLimitOf({ facts });
  const shownUsd = shown.usd;
  const shownSource = shown.source;

  const change = useCallback((next: number | null): void => setDraft({ usd: next }), []);

  const persist = useCallback(async (): Promise<StartLimit> => {
    const shownLimit: StartLimit = { usd: shownUsd, source: shownSource };
    if (workspaceId === null || isFromSession || draft === null) {
      return shownLimit;
    }
    if (draft.usd === storedUsd) {
      setDraft(null);
      return shownLimit;
    }
    await writeAutoTreeLimit({ db: tauriDatabase, workspaceId, usd: draft.usd });
    await loadWorkspaceValue({ workspaceId, key: 'auto.treeLimitUsd' });
    setDraft(null);
    return shownLimit;
  }, [draft, isFromSession, loadWorkspaceValue, shownSource, shownUsd, storedUsd, workspaceId]);

  return {
    usd: facts.usd,
    isFromSession,
    isDefault: facts.isDefault,
    defaultUsd: facts.defaultUsd,
    isStored: storedUsd !== null,
    tiers: limitTiersOf({
      session: { capUsd: sessionCapUsd, spentUsd: sessionSpentUsd },
      months: monthTiersOf({ statuses }),
    }),
    change,
    persist,
  };
};
