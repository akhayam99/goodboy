import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_AUTO_LEVEL, type AutoLevel } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { parseAutoLevelSetting } from '../../../store/runtime/auto/level/parseAutoLevelSetting';
import { createLatestOnly } from '../../../store/runtime/state-writes/latestOnly';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
};

type PickParams = {
  readonly next: AutoLevel;
};

export type AutoLevelModel = Readonly<{
  level: AutoLevel;
  workspaceLevel: AutoLevel;
  error: string | null;
  pick: (params: PickParams) => Promise<void>;
}>;

const LEVEL_KEY = 'auto.level';
const PICK_KEY = 'auto-level-pick';

export const useAutoLevel = ({ workspaceId, sessionId }: Params): AutoLevelModel => {
  const raw = useAppStore((state) => state.workspaceValues[workspaceId]?.[LEVEL_KEY] ?? null);
  const loadWorkspaceValue = useAppStore((state) => state.loadWorkspaceValue);
  const changeAutoLevel = useAppStore((state) => state.changeAutoLevel);
  const reportError = useAppStore((state) => state.reportError);
  const [error, setError] = useState<string | null>(null);
  const latestRef = useRef(createLatestOnly());
  const stored = parseAutoLevelSetting({ raw });
  const workspaceLevel = stored.defaultLevel ?? DEFAULT_AUTO_LEVEL;
  const level = (sessionId === null ? null : stored.sessions[sessionId]) ?? workspaceLevel;

  useEffect(() => {
    loadWorkspaceValue({ workspaceId, key: LEVEL_KEY }).catch((failure: unknown) => {
      void reportError({ title: "Couldn't read the Auto level", error: failure, workspaceId });
    });
  }, [workspaceId, loadWorkspaceValue, reportError]);

  useEffect(() => {
    const latest = latestRef.current;
    setError(null);
    return () => latest.cancel({ key: PICK_KEY });
  }, [workspaceId, sessionId]);

  const pick = useCallback(
    async ({ next }: PickParams): Promise<void> => {
      setError(null);
      try {
        await latestRef.current.run({
          key: PICK_KEY,
          request: () => changeAutoLevel({ workspaceId, sessionId, level: next }),
          apply: () => undefined,
        });
      } catch (failure) {
        setError(`Couldn't change it. ${formatError(failure)}`);
      }
    },
    [changeAutoLevel, sessionId, workspaceId],
  );

  return { level, workspaceLevel, error, pick };
};
