import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { AppStore } from '../../../store/store';
import { pickKeys } from '../../utils/pickKeys';

type Params = {
  readonly sessionId: SessionId;
  readonly extraMountIds?: ReadonlyArray<string>;
};

type Result = Pick<AppStore, 'mountGithub' | 'mountGitlabMr' | 'mountBitbucketPr'>;

const NO_MOUNT_IDS: ReadonlyArray<string> = [];

export const useSessionMountHosts = ({
  sessionId,
  extraMountIds = NO_MOUNT_IDS,
}: Params): Result => {
  const views = useAppStore((state) => state.sessionMounts[sessionId]);
  const projectMounts = useAppStore((state) => state.sessionProjectMounts[sessionId]);
  const mountIds = useMemo(() => {
    const ids = new Set<string>(extraMountIds);
    for (const view of views ?? []) {
      ids.add(view.id);
    }
    for (const mount of projectMounts ?? []) {
      ids.add(mount.mountId);
    }
    return ids.size === 0 ? NO_MOUNT_IDS : [...ids];
  }, [extraMountIds, projectMounts, views]);
  const mountGithub = useAppStore(
    useShallow((state) => pickKeys({ source: state.mountGithub, keys: mountIds })),
  );
  const mountGitlabMr = useAppStore(
    useShallow((state) => pickKeys({ source: state.mountGitlabMr, keys: mountIds })),
  );
  const mountBitbucketPr = useAppStore(
    useShallow((state) => pickKeys({ source: state.mountBitbucketPr, keys: mountIds })),
  );
  return useMemo(
    () => ({ mountGithub, mountGitlabMr, mountBitbucketPr }),
    [mountBitbucketPr, mountGithub, mountGitlabMr],
  );
};
