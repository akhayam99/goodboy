import { useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { usePoll } from '../../../../shared/lib/usePoll';
import { useAppStore } from '../../../../store';
import { SETTING_REPO_CHECK_MINUTES } from '../../../settings/settings';
import { repoCheckMinutesOf } from '../../repoCheckMinutesOf';

const MINUTE_MS = 60_000;
const FRESH_SHARE = 0.9;

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useRepoDivergenceCheck = ({ workspaceId }: Params): void => {
  const raw = useAppStore((state) => state.settings[SETTING_REPO_CHECK_MINUTES]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);
  const checkRepoDivergence = useAppStore((state) => state.checkRepoDivergence);
  const hasRepos = useAppStore((state) =>
    state.projects.some(
      (project) =>
        project.workspaceId === workspaceId &&
        project.kind === 'repo' &&
        project.disconnectedAt == null,
    ),
  );
  const minutes = repoCheckMinutesOf({ value: raw });

  useEffect(() => {
    if (raw !== undefined) {
      return;
    }
    void loadSetting(SETTING_REPO_CHECK_MINUTES).catch((error: unknown) =>
      reportError({ title: "Couldn't read how often to check the repositories", error }),
    );
  }, [raw, loadSetting, reportError]);

  const intervalMs = minutes * MINUTE_MS;
  const maxAgeMs = Math.round(intervalMs * FRESH_SHARE);

  usePoll({
    run: () => void checkRepoDivergence({ workspaceId, maxAgeMs }),
    everyMs: intervalMs,
    isEnabled: minutes !== 0 && hasRepos,
    restartKey: workspaceId,
  });
};
