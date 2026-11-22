import type { WorktreeTrack } from '../track/tracksOfWorkspace';
import { folderStatusLabel } from './storageCopy';

type Params = {
  readonly track: WorktreeTrack;
};

export const worktreeStateLabel = ({ track }: Params): string => {
  const { folder, verdict, liveTerminals } = track;
  if (verdict === 'checking') {
    return 'Checking';
  }
  if (verdict === 'dirty') {
    return 'Unsaved changes';
  }
  if (verdict !== 'safe') {
    return folderStatusLabel({ folder, status: verdict, liveTerminals });
  }
  const ahead = folder.facts?.localOnlyCommits ?? 0;
  return ahead > 0 ? `${ahead} ahead` : 'Clean';
};
