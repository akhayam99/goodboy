import { useMemo } from 'react';
import type { Agent, AgentId, Session, SessionMountView } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { agentBranchLabelsOf } from '../../agentBranchLabelsOf';
import { useSessionRuns } from '../useSessionRuns';

type Params = {
  readonly session: Session;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_MOUNTS: ReadonlyArray<SessionMountView> = [];

export const useAgentBranchLabels = ({ session }: Params): ReadonlyMap<AgentId, string> => {
  const sessionId = session.id;
  const runs = useSessionRuns({ session });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const mounts = useAppStore((state) => state.sessionMounts[sessionId] ?? NO_MOUNTS);
  const projects = useAppStore((state) => state.projects);
  return useMemo(
    () => agentBranchLabelsOf({ runs, agents, mounts, projects }),
    [runs, agents, mounts, projects],
  );
};
