import { useEffect, useState } from 'react';
import { prViewsOf } from '../prViewsOf';
import { useAppStore } from '../../../../../store';
import type { HistoryDraft, HistoryRun } from '../../../../../store/slices/history/types';
import type { MountGithubState } from '../../../../../store/types';
import { ShellFrame } from '../shellChrome';
import { seedContextBase } from './contextBase';
import { HistoryStage } from './HistoryStage';
import { CTX_HISTORY_SCOPE, LEDGER_SCOPE } from './historySceneSeed';

type Props = {
  readonly draft: HistoryDraft;
  readonly run: HistoryRun | null;
  readonly github: MountGithubState | null;
  readonly isLedger: boolean;
};

export const HistorySceneShell = ({ draft, run, github, isLedger }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const scope = isLedger ? LEDGER_SCOPE : CTX_HISTORY_SCOPE;

  useEffect(() => {
    const sessionId = scope.session.id;
    seedContextBase({ lens: 'branch', current: scope.session });
    useAppStore.setState((state) => ({
      sessionProjectMounts: { ...state.sessionProjectMounts, [sessionId]: [...scope.mounts] },
      sessionActiveProject: { ...state.sessionActiveProject, [sessionId]: scope.projectId },
      sessionActiveMount: { ...state.sessionActiveMount, [sessionId]: scope.mountId },
      sessionWorktrees: {
        ...state.sessionWorktrees,
        [sessionId]: scope.mounts.map((mount) => mount.worktreePath),
      },
      sessionLoading: {
        ...state.sessionLoading,
        [sessionId]: {
          agents: false,
          transcript: false,
          telemetry: false,
          slots: false,
          plans: false,
          summary: false,
        },
      },
      diffFocus: {},
      branchTab: { [sessionId]: 'commits' },
      branchThreadId: {},
      historyDrafts: { [scope.mountId]: draft },
      historyRuns: run === null ? {} : { [scope.mountId]: run },
      mountGithub: github === null ? {} : { [scope.mountId]: github },
      pullRequestViews:
        github?.pr == null
          ? {}
          : prViewsOf({
              sessionId,
              mountId: scope.mountId,
              pr: github.pr,
              commits: draft.commits,
            }),
      loadHistoryDraft: async () => undefined,
    }));
    setIsReady(true);
  }, [draft, github, run, scope]);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={scope.session}
      main={<HistoryStage commits={draft.commits} scope={scope} />}
    />
  );
};
