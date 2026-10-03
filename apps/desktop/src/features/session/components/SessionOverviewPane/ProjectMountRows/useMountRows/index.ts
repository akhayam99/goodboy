import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import {
  buildMountRows,
  type MountProjectGroup,
} from '../../../../../../store/slices/project-mounts/mountRowModel';
import { pickKeys } from '../../../../../../shared/utils/pickKeys';

type Params = {
  readonly sessionId: SessionId;
};

const NO_MOUNT_IDS: ReadonlyArray<string> = [];

export const useMountRows = ({ sessionId }: Params): ReadonlyArray<MountProjectGroup> => {
  const projects = useAppStore((state) => state.projects);
  const views = useAppStore((state) => state.sessionMounts[sessionId]);
  const projectMounts = useAppStore((state) => state.sessionProjectMounts[sessionId]);
  const mountIds = useMemo(() => {
    const ids = new Set<string>();
    for (const view of views ?? []) {
      ids.add(view.id);
    }
    for (const mount of projectMounts ?? []) {
      ids.add(mount.mountId);
    }
    return ids.size === 0 ? NO_MOUNT_IDS : [...ids];
  }, [projectMounts, views]);
  const mountGithub = useAppStore(
    useShallow((state) => pickKeys({ source: state.mountGithub, keys: mountIds })),
  );
  const mountGitlabMr = useAppStore(
    useShallow((state) => pickKeys({ source: state.mountGitlabMr, keys: mountIds })),
  );
  const mountBitbucketPr = useAppStore(
    useShallow((state) => pickKeys({ source: state.mountBitbucketPr, keys: mountIds })),
  );
  const observations = useAppStore((state) => state.mountBranchObservations[sessionId]);
  const prSeries = useAppStore((state) => state.prSeries[sessionId]);

  return useMemo(
    () =>
      buildMountRows({
        sessionId,
        state: {
          projects,
          sessionMounts: views === undefined ? {} : { [sessionId]: views },
          sessionProjectMounts: projectMounts === undefined ? {} : { [sessionId]: projectMounts },
          mountGithub,
          mountGitlabMr,
          mountBitbucketPr,
          mountBranchObservations: observations === undefined ? {} : { [sessionId]: observations },
          prSeries: prSeries === undefined ? {} : { [sessionId]: prSeries },
        },
      }),
    [
      mountBitbucketPr,
      mountGithub,
      mountGitlabMr,
      observations,
      prSeries,
      projectMounts,
      projects,
      sessionId,
      views,
    ],
  );
};
