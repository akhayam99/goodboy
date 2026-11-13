import type { Agent, AgentId, SessionId } from '@goodboy/types';
import {
  listAgentOutputSummaries,
  listAgentSummariesForSessions,
  listAgentsForSessions,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { needsFullAgentRows } from '../agents/needsFullAgentRows';
import { unreadAgentsOf } from '../agents/unreadAgentsOf';

type Params = {
  readonly sessionIds: ReadonlyArray<SessionId>;
};

type GroupParams = {
  readonly agents: ReadonlyArray<Agent>;
};

export type LaunchAgents = {
  readonly agentsBySession: ReadonlyMap<SessionId, ReadonlyArray<Agent>>;
  readonly lightAgentSessions: Readonly<Record<SessionId, true>>;
};

const groupBySession = ({ agents }: GroupParams): Map<SessionId, ReadonlyArray<Agent>> => {
  const out = new Map<SessionId, Agent[]>();
  for (const agent of agents) {
    const bucket = out.get(agent.sessionId) ?? [];
    bucket.push(agent);
    out.set(agent.sessionId, bucket);
  }
  return out;
};

export const loadLaunchAgents = async ({ sessionIds }: Params): Promise<LaunchAgents> => {
  const summaries = groupBySession({
    agents: await listAgentSummariesForSessions({ db: tauriDatabase, sessionIds }),
  });
  const fullIds = [...summaries]
    .filter(([, agents]) => needsFullAgentRows({ agents }))
    .map(([sessionId]) => sessionId);
  const lightIds = [...summaries.keys()].filter((sessionId) => !fullIds.includes(sessionId));
  const labelIds = lightIds.flatMap((sessionId): ReadonlyArray<AgentId> => {
    const newest = unreadAgentsOf({ agents: summaries.get(sessionId) }).at(0);
    return newest === undefined ? [] : [newest.id];
  });
  const [full, labels] = await Promise.all([
    listAgentsForSessions(tauriDatabase, fullIds),
    listAgentOutputSummaries({ db: tauriDatabase, agentIds: labelIds }),
  ]);
  const labelById = new Map(labels.map((label) => [label.agentId, label.outputSummary]));
  const agentsBySession = new Map<SessionId, ReadonlyArray<Agent>>();
  const lightAgentSessions: Record<SessionId, true> = {};
  for (const sessionId of fullIds) {
    agentsBySession.set(sessionId, full.get(sessionId) ?? []);
  }
  for (const sessionId of lightIds) {
    lightAgentSessions[sessionId] = true;
    agentsBySession.set(
      sessionId,
      (summaries.get(sessionId) ?? []).map((agent) => {
        const outputSummary = labelById.get(agent.id);
        return outputSummary === undefined ? agent : { ...agent, outputSummary };
      }),
    );
  }
  return { agentsBySession, lightAgentSessions };
};
