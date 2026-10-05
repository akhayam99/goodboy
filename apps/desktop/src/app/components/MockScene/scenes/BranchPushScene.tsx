import { BranchSceneShell } from './BranchSceneShell';
import { THREAD_IDS } from './resolveSeed';

export const BranchPushScene = () => (
  <BranchSceneShell width={null} openPush threadId={THREAD_IDS.logRedact} />
);
