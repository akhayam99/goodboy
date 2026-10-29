import { useEffect, useState } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectMountById } from '../../store/slices/project-mounts/selectors';
import { useWorktreeDeps } from '../hooks/useWorktreeDeps';
import { ReinstallDepsAction } from './ReinstallDepsAction';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly isForced?: boolean;
  readonly onInstalled?: () => void;
};

export const StaleDepsAction = ({ sessionId, mountId, isForced = false, onInstalled }: Props) => {
  const worktreePath = useAppStore(
    (state) => selectMountById({ state, sessionId, mountId })?.worktreePath ?? null,
  );
  const repoPath = useAppStore(
    (state) => selectMountById({ state, sessionId, mountId })?.repoRoot ?? null,
  );
  const { finding, recheck } = useWorktreeDeps({ repoPath, worktreePath });
  const [isOffered, setIsOffered] = useState(false);
  useEffect(() => {
    if (finding !== null) {
      setIsOffered(true);
    }
  }, [finding]);
  if (!(isOffered || isForced) || repoPath === null || worktreePath === null) {
    return null;
  }
  return (
    <ReinstallDepsAction
      sessionId={sessionId}
      mountId={mountId}
      repoPath={repoPath}
      worktreePath={worktreePath}
      onInstalled={() => {
        recheck();
        onInstalled?.();
      }}
    />
  );
};
