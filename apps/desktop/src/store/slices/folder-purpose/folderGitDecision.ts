import type { FolderGitProbe, FolderPurpose, Project } from '@goodboy/types';
import type { FolderGitChoice } from './state';

export type FolderGitDecision = 'keep' | 'switch' | 'wait' | 'ask' | 'ask-above';

type Params = {
  readonly kind: Project['kind'];
  readonly purpose: FolderPurpose | null;
  readonly probe: FolderGitProbe;
  readonly choice: FolderGitChoice | null;
  readonly isWriting: boolean;
  readonly hasNotice: boolean;
};

export const folderGitDecision = ({
  kind,
  purpose,
  probe,
  choice,
  isWriting,
  hasNotice,
}: Params): FolderGitDecision => {
  if (kind !== 'folder' || choice === 'in-place' || hasNotice) {
    return 'keep';
  }
  if (probe.state === 'above') {
    return 'ask-above';
  }
  if (probe.state !== 'tracked') {
    return 'keep';
  }
  if (purpose !== 'code') {
    return 'ask';
  }
  return isWriting ? 'wait' : 'switch';
};
