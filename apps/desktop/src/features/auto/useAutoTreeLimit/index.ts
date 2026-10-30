import { useCallback, useEffect, useState } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { tauriDatabase } from '../../../shared/lib/db';
import { pausingSessionCapOf } from '../../budget/pausingSessionCapOf';
import { autoLimitOf } from '../autoLimitOf';
import { parseAutoTreeLimit, writeAutoTreeLimit } from '../autoTreeLimit';

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
  change: (usd: number | null) => void;
  persist: () => Promise<void>;
}>;

export const useAutoTreeLimit = ({ workspaceId, sessionId = null }: Params): AutoTreeLimitModel => {
  const raw = useAppStore((state) =>
    workspaceId === null ? undefined : state.workspaceValues[workspaceId]?.['auto.treeLimitUsd'],
  );
  const sessionCapUsd = useAppStore((state) =>
    sessionId === null ? null : pausingSessionCapOf({ budget: state.sessionBudgets[sessionId] }),
  );
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

  const change = useCallback((next: number | null): void => setDraft({ usd: next }), []);

  const persist = useCallback(async (): Promise<void> => {
    if (workspaceId === null || isFromSession || draft === null) {
      return;
    }
    if (draft.usd === storedUsd) {
      setDraft(null);
      return;
    }
    await writeAutoTreeLimit({ db: tauriDatabase, workspaceId, usd: draft.usd });
    await loadWorkspaceValue({ workspaceId, key: 'auto.treeLimitUsd' });
    setDraft(null);
  }, [draft, isFromSession, loadWorkspaceValue, storedUsd, workspaceId]);

  return {
    usd: facts.usd,
    isFromSession,
    isDefault: facts.isDefault,
    defaultUsd: facts.defaultUsd,
    isStored: storedUsd !== null,
    change,
    persist,
  };
};
