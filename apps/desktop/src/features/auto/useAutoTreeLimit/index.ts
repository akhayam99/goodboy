import { useCallback, useEffect, useState } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { tauriDatabase } from '../../../shared/lib/db';
import { pausingSessionCapOf } from '../../budget/pausingSessionCapOf';
import {
  AUTO_TREE_LIMIT_DEFAULT_USD,
  parseAutoTreeLimit,
  writeAutoTreeLimit,
} from '../autoTreeLimit';

type Params = {
  readonly workspaceId: WorkspaceId | null;
  readonly sessionId?: SessionId | null;
};

export type AutoTreeLimitModel = Readonly<{
  usd: number;
  isFromSession: boolean;
  isStored: boolean;
  change: (usd: number) => void;
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
  const [draftUsd, setDraftUsd] = useState<number | null>(null);
  const storedUsd = parseAutoTreeLimit({ raw });

  useEffect(() => {
    if (workspaceId === null) {
      return;
    }
    loadWorkspaceValue({ workspaceId, key: 'auto.treeLimitUsd' }).catch((error: unknown) => {
      void reportError({ title: "Couldn't read the Auto limit", error });
    });
  }, [workspaceId, loadWorkspaceValue, reportError]);

  const usd = draftUsd ?? storedUsd ?? AUTO_TREE_LIMIT_DEFAULT_USD;
  const isFromSession = sessionCapUsd !== null && sessionCapUsd < usd;

  const persist = useCallback(async (): Promise<void> => {
    const isNothingToSave = draftUsd === null && storedUsd !== null;
    if (workspaceId === null || isFromSession || isNothingToSave) {
      return;
    }
    await writeAutoTreeLimit({ db: tauriDatabase, workspaceId, usd });
    await loadWorkspaceValue({ workspaceId, key: 'auto.treeLimitUsd' });
    setDraftUsd(null);
  }, [draftUsd, isFromSession, loadWorkspaceValue, storedUsd, usd, workspaceId]);

  return {
    usd: isFromSession ? sessionCapUsd : usd,
    isFromSession,
    isStored: storedUsd !== null,
    change: setDraftUsd,
    persist,
  };
};
