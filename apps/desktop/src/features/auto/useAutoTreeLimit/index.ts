import { useCallback, useState } from 'react';
import type { SessionId, TelemetryRecord, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { limitTiersOf, monthTiersOf } from '../../budget/limitTiersOf';
import { pausingSessionCapOf } from '../../budget/pausingSessionCapOf';
import { sumSessionCost } from '../../../store/slices/sessions/sumSessionCost';
import { autoLimitOf } from '../autoLimitOf';
import { startLimitOf, type StartLimit } from '../startLimitOf';
import { runDefaultLimitOf } from '../../../store/slices/workflows/runLimit/runDefaultLimitOf';

type Params = {
  readonly workspaceId: WorkspaceId | null;
  readonly sessionId?: SessionId | null;
};

export type AutoTreeLimitView = Readonly<{
  usd: number | null;
  isFromSession: boolean;
  isDefault: boolean;
  defaultUsd: number | null;
  tiers: string;
  change: (usd: number | null) => void;
}>;

export type AutoTreeLimitModel = Readonly<{
  view: AutoTreeLimitView;
  start: () => StartLimit;
  settle: () => void;
}>;

const NO_RECORDS: ReadonlyArray<TelemetryRecord> = [];

export const useAutoTreeLimit = ({ workspaceId, sessionId = null }: Params): AutoTreeLimitModel => {
  const sessionCapUsd = useAppStore((state) =>
    sessionId === null ? null : pausingSessionCapOf({ budget: state.sessionBudgets[sessionId] }),
  );
  const sessionSpentUsd = useAppStore((state) =>
    sessionId === null ? null : sumSessionCost(state.sessionTelemetry[sessionId] ?? NO_RECORDS),
  );
  const statuses = useAppStore((state) => state.providerBudgetStatus);
  const runDefaultUsd = useAppStore((state) =>
    workspaceId === null ? null : runDefaultLimitOf({ state, workspaceId }),
  );
  const [draftUsd, setDraftUsd] = useState<number | null | undefined>(undefined);
  const tiers = limitTiersOf({
    session: { capUsd: sessionCapUsd, spentUsd: sessionSpentUsd },
    months: monthTiersOf({ statuses }),
  });
  const facts = autoLimitOf({ storedUsd: runDefaultUsd, draftUsd, sessionCapUsd });
  const change = useCallback((next: number | null): void => setDraftUsd(next), []);
  const settle = useCallback((): void => setDraftUsd(undefined), []);
  const start = useCallback((): StartLimit => startLimitOf({ facts }), [facts]);

  return {
    view: {
      usd: facts.usd,
      isFromSession: facts.isFromSession,
      isDefault: facts.isDefault,
      defaultUsd: facts.defaultUsd,
      tiers,
      change,
    },
    start,
    settle,
  };
};
