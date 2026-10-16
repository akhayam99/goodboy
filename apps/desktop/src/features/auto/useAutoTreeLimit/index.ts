import { useCallback, useEffect, useState } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { tauriDatabase } from '../../../shared/lib/db';
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
    sessionId === null ? null : (state.sessionBudgets[sessionId]?.softCapUsd ?? null),
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

  const persist = useCallback(async (): Promise<void> => {
    const isNothingToSave = draftUsd === null && storedUsd !== null;
    if (workspaceId === null || key === null || sessionCapUsd !== null || isNothingToSave) {
      return;
    }
    await writeAutoTreeLimit({ db: tauriDatabase, workspaceId, usd });
    await loadSetting(key);
    setDraftUsd(null);
  }, [draftUsd, key, loadSetting, sessionCapUsd, storedUsd, usd, workspaceId]);

  return {
    usd: sessionCapUsd ?? usd,
    isFromSession: sessionCapUsd !== null,
    isStored: storedUsd !== null,
    change: setDraftUsd,
    persist,
  };
};
