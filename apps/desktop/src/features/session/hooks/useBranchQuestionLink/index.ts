import { useMemo } from 'react';
import type { MountId, Session, SessionMountView } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { BranchWorkLink } from '../../branchWorkLinkOf';
import { questionBranchGroupsOf } from '../../components/SessionWorkspace/parts/questionsLensModel';
import { useMountRows } from '../../components/SessionOverviewPane/ProjectMountRows/useMountRows';
import { questionBranchLinkOf } from '../../questionBranchLinkOf';
import { useQuestionsLens } from '../useQuestionsLens';

type Params = {
  readonly session: Session;
  readonly mountId: MountId | null;
};

const NO_MOUNTS: ReadonlyArray<SessionMountView> = [];

export const useBranchQuestionLink = ({ session, mountId }: Params): BranchWorkLink | null => {
  const sessionId = session.id;
  const { model, agents } = useQuestionsLens({ sessionId, load: 'when-missing' });
  const sessionMounts = useAppStore((state) => state.sessionMounts[sessionId] ?? NO_MOUNTS);
  const projects = useAppStore((state) => state.projects);
  const mountGroups = useMountRows({ sessionId });
  return useMemo(() => {
    if (mountId === null) {
      return null;
    }
    const mounts = mountGroups.flatMap((group) => [...group.rows, ...group.finishedRows]);
    const groups = questionBranchGroupsOf({ model, agents, sessionMounts, projects, mounts });
    return questionBranchLinkOf({ groups, mounts, mountId });
  }, [model, agents, sessionMounts, projects, mountGroups, mountId]);
};
