import type {
  MountId,
  ProjectScript,
  ProjectScriptId,
  SessionId,
  SessionMountView,
  SessionProjectMount,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { sceneClock } from '../../sceneClock';
import { seedBoardScene } from '../BoardScene';

export const SCRIPTS_BRANCH_SCRIPT_NAME = 'Replay settlement batch';

const SEEDED_AT = sceneClock({ anchor: '2026-11-12T09:30:00.000Z' }).iso({
  at: '2026-11-12T09:30:00.000Z',
});

const BRANCHES = ['hl/payout-export', 'hl/payout-webhook'];

const SCRIPT_IDS = ['script-replay-settlement'].filter((id): id is ProjectScriptId =>
  id.startsWith('script-'),
);

export const seedScriptsBranchStep = (): SessionId => {
  seedBoardScene();
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  const [project] = state.projects.filter((candidate) => candidate.workspaceId === workspaceId);
  const [session] = state.sessions.filter((candidate) => candidate.id.endsWith('payout-export'));
  const [scriptId] = SCRIPT_IDS;
  if (
    workspaceId === null ||
    project === undefined ||
    session === undefined ||
    scriptId === undefined
  ) {
    throw new Error('the board scene has no payout session');
  }
  const mounts = BRANCHES.flatMap((branch) =>
    [`mount-${branch.replace('/', '-')}`]
      .filter((id): id is MountId => id.startsWith('mount-'))
      .map((mountId): SessionProjectMount => ({
        mountId,
        sessionId: session.id,
        projectId: project.id,
        mountName: project.name,
        worktreePath: `/mock/harborline/${branch.replace('/', '-')}`,
        lastWorktreePath: null,
        repoRoot: project.rootPath,
        branch,
        baseBranch: 'main',
        parallelIndex: 0,
        isAttached: true,
        diskState: 'present',
        revision: 1,
      })),
  );
  const views = mounts.map((mount): SessionMountView => ({
    ...mount,
    id: mount.mountId,
    repoSlug: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  }));
  const script: ProjectScript = {
    id: scriptId,
    projectId: project.id,
    name: SCRIPTS_BRANCH_SCRIPT_NAME,
    body: 'pnpm --filter ledger-core exec node ./tools/replay.mjs',
    sortOrder: 0,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  };
  useAppStore.setState((current) => ({
    sessionProjectMounts: { ...current.sessionProjectMounts, [session.id]: mounts },
    sessionMounts: { ...current.sessionMounts, [session.id]: views },
    projectScripts: { ...current.projectScripts, [workspaceId]: [script] },
  }));
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId: session.id }) });
  return session.id;
};
