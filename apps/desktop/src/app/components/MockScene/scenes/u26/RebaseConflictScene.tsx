import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { SESSION_ID } from '../resolveSeed';
import { WorktreeScene, type WorktreeSceneConfig } from '../u25/c04WorktreeScene';
import { AUTO_PROVIDERS, conflictRunOf } from './rebaseSeed';

type Props = {
  readonly theme: 'dark' | 'light';
};

const CONFIG: WorktreeSceneConfig = {
  variant: 'github',
  level: 'worktree',
  tab: 'commits',
  gitState: 'behind',
};

const FILES = ['src/ledger/postCredit.ts', 'src/webhooks/dedupe.ts'];

export const RebaseConflictScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  useEffect(() => {
    const [mount] = useAppStore.getState().sessionProjectMounts[SESSION_ID] ?? [];
    if (mount === undefined) {
      return;
    }
    useAppStore.setState((state) => ({
      providers: AUTO_PROVIDERS,
      historyRuns: {
        ...state.historyRuns,
        [mount.mountId]: conflictRunOf({
          sessionId: SESSION_ID,
          mountId: mount.mountId,
          files: FILES,
        }),
      },
    }));
  }, []);
  return <WorktreeScene config={CONFIG} />;
};
