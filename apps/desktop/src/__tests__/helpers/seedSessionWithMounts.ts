import type { SessionId, SessionMountView } from '@goodboy/types';
import { STORY_NOW, type StoryStore } from '../../store/storyHarness';
import { seedBoardScene } from '../../app/components/MockScene/scenes/BoardScene';

type Params = {
  readonly useAppStore: StoryStore;
};

export const seedSessionWithMounts = ({ useAppStore }: Params): SessionId => {
  seedBoardScene();
  const state = useAppStore.getState();
  const session = state.sessions.find(
    (candidate) => (state.sessionProjectMounts[candidate.id]?.length ?? 0) > 0,
  );
  if (session === undefined) {
    throw new Error('the board seed has no session with a mount');
  }
  const views: ReadonlyArray<SessionMountView> = (state.sessionProjectMounts[session.id] ?? []).map(
    (mount) => ({
      id: mount.mountId,
      sessionId: session.id,
      projectId: mount.projectId,
      worktreePath: mount.worktreePath,
      lastWorktreePath: mount.lastWorktreePath,
      branch: mount.branch,
      baseBranch: mount.baseBranch,
      parallelIndex: mount.parallelIndex,
      mountName: mount.mountName,
      repoSlug: null,
      repoRoot: mount.repoRoot,
      isAttached: true,
      diskState: 'present',
      revision: mount.revision,
      createdAt: STORY_NOW,
      updatedAt: STORY_NOW,
    }),
  );
  useAppStore.setState({
    currentSessionId: session.id,
    sessionMounts: { ...state.sessionMounts, [session.id]: views },
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [session.id]: state.sessionPhaseRuns[session.id] ?? [],
    },
    sessionPlans: { ...state.sessionPlans, [session.id]: state.sessionPlans[session.id] ?? [] },
  });
  return session.id;
};
