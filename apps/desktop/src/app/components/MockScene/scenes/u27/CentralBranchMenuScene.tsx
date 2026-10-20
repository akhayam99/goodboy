import { WorktreeScene, type WorktreeSceneConfig } from '../u25/c04WorktreeScene';
import { SESSION_ID } from '../resolveSeed';
import { SceneCentralBranches } from './SceneCentralBranches';

const CONFIG: WorktreeSceneConfig = {
  variant: 'none',
  level: 'session',
  gitState: 'behind',
  hasMoreProjects: false,
};

export const CentralBranchMenuScene = () => (
  <WorktreeScene config={CONFIG}>
    <SceneCentralBranches sessionId={SESSION_ID} />
  </WorktreeScene>
);
