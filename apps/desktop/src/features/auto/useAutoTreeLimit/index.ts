import { useCallback, useEffect, useState } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { tauriDatabase } from '../../../shared/lib/db';
import { pausingSessionCapOf } from '../../budget/pausingSessionCapOf';
import {
  AUTO_TREE_LIMIT_DEFAULT_USD,
  autoTreeLimitKey,
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
  const key = workspaceId === null ? null : autoTreeLimitKey({ workspaceId });
  const raw = useAppStore((state) => (key === null ? undefined : state.settings[key]));
  const sessionCapUsd = useAppStore((state) =>
    sessionId === null ? null : pausingSessionCapOf({ budget: state.sessionBudgets[sessionId] }),
  );
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);
  const [draftUsd, setDraftUsd] = useState<number | null>(null);
  const storedUsd = parseAutoTreeLimit({ raw });

  useEffect(() => {
    if (key === null) {
      return;
    }
    loadSetting(key).catch((error: unknown) => {
      void reportError({ title: "Couldn't read the Auto limit", error });
    });
  }, [key, loadSetting, reportError]);

  const usd = draftUsd ?? storedUsd ?? AUTO_TREE_LIMIT_DEFAULT_USD;
  const isFromSession = sessionCapUsd !== null && sessionCapUsd < usd;

  const persist = useCallback(async (): Promise<void> => {
    const isNothingToSave = draftUsd === null && storedUsd !== null;
    if (workspaceId === null || key === null || isFromSession || isNothingToSave) {
      return;
    }
    await writeAutoTreeLimit({ db: tauriDatabase, workspaceId, usd });
    await loadSetting(key);
    setDraftUsd(null);
  }, [draftUsd, isFromSession, key, loadSetting, storedUsd, usd, workspaceId]);

  return {
    usd: isFromSession ? sessionCapUsd : usd,
    isFromSession,
    isStored: storedUsd !== null,
    change: setDraftUsd,
    persist,
  };
};
