import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import {
  buildMountRows,
  type MountProjectGroup,
} from '../../../store/slices/project-mounts/mountRowModel';
import { useSessionMountHosts } from '../useSessionMountHosts';

type Params = {
  readonly sessionId: SessionId;
};

export const useMountRows = ({ sessionId }: Params): ReadonlyArray<MountProjectGroup> => {
  const projects = useAppStore((state) => state.projects);
  const views = useAppStore((state) => state.sessionMounts[sessionId]);
  const projectMounts = useAppStore((state) => state.sessionProjectMounts[sessionId]);
  const { mountGithub, mountRequests } = useSessionMountHosts({ sessionId });
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
          mountRequests,
          mountBranchObservations: observations === undefined ? {} : { [sessionId]: observations },
          prSeries: prSeries === undefined ? {} : { [sessionId]: prSeries },
        },
      }),
    [mountGithub, mountRequests, observations, prSeries, projectMounts, projects, sessionId, views],
  );
};
