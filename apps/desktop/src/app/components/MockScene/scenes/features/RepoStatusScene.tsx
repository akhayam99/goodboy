import { useEffect } from 'react';
import type { ProjectId, WorkspaceGitStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { BoardShellScene } from '../BoardShellScene';

const PAYMENTS_ID = 'mock-board-project-payments-api' as ProjectId;
const RELAY_ID = 'mock-board-project-notify-relay' as ProjectId;
const LEDGER_ID = 'mock-board-project-ledger-core' as ProjectId;

const status = (params: {
  readonly headSubject: string;
  readonly ahead: number;
  readonly behind: number;
  readonly changed: number;
}): WorkspaceGitStatus => ({
  state: 'ready',
  branch: 'main',
  headSubject: params.headSubject,
  upstreamDistance: { kind: 'known', ahead: params.ahead, behind: params.behind },
  workingTree: {
    kind: 'known',
    staged: 0,
    unstaged: params.changed,
    untracked: 0,
    unmerged: 0,
    changed: params.changed,
  },
  upstream: 'origin/main',
  inProgress: null,
});

const STATUSES: Readonly<Record<ProjectId, WorkspaceGitStatus>> = {
  [PAYMENTS_ID]: status({
    headSubject: 'Bump the lockfile after the security patch',
    ahead: 0,
    behind: 2,
    changed: 0,
  }),
  [RELAY_ID]: status({
    headSubject: 'Retire the legacy export cron job',
    ahead: 0,
    behind: 0,
    changed: 1,
  }),
  [LEDGER_ID]: status({
    headSubject: 'Ship the reconciliation report exporter',
    ahead: 0,
    behind: 0,
    changed: 0,
  }),
};

const OPEN_DELAY_MS = 1200;

export const RepoStatusScene = () => {
  useEffect(() => {
    const id = window.setTimeout(() => {
      useAppStore.setState({
        projectGitStatus: STATUSES,
        loadProjectGitStatus: async () => undefined,
        fetchProjectCheckouts: async () => undefined,
      });
      const trigger = document.querySelector<HTMLButtonElement>(
        'button[aria-label$="repository git statuses"]',
      );
      trigger?.click();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  return <BoardShellScene />;
};
