import type { ProjectId, WorkspaceGitStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SettingsFrame } from '../audit/SettingsFrame';

const readyStatus: WorkspaceGitStatus = {
  state: 'ready',
  branch: 'main',
  headSubject: 'Bump the lockfile after the security patch',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/main',
  inProgress: null,
};

const STATUSES: Readonly<Record<ProjectId, WorkspaceGitStatus>> = {
  ['mock-settings-ledger' as ProjectId]: readyStatus,
  ['mock-settings-relay' as ProjectId]: readyStatus,
  ['mock-settings-payments' as ProjectId]: readyStatus,
};

const seed = (): void => {
  useAppStore.setState({
    projectGitStatus: STATUSES,
    loadProjectGitStatus: async () => undefined,
  });
};

export const WorkspaceProjectsScene = () => (
  <SettingsFrame focus={{ scope: 'workspace' }} seed={seed} />
);
