import type { Agent, AgentId, OpenQuestion, TurnState } from '@goodboy/types';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { autoTreeWordOf } from '../../../auto/autoTreeWordOf';
import type { BoardAgent, BoardAsk, BoardLead } from './boardTypes';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly rootTurns: Readonly<Record<string, TurnState | undefined>>;
  readonly ownSpendByAgentId: ReadonlyMap<AgentId, number>;
  readonly now: number;
};

type BoardInputs = Readonly<{
  agents: ReadonlyArray<BoardAgent>;
  asks: ReadonlyArray<BoardAsk>;
  leads: ReadonlyArray<BoardLead>;
}>;

type IdParams = {
  readonly id: AgentId;
};

type ElapsedParams = {
  readonly agent: Agent;
  readonly now: number;
};

const elapsedOf = ({ agent, now }: ElapsedParams): number => {
  if (agent.startedAt === undefined) {
    return 0;
  }
  const start = Date.parse(agent.startedAt);
  const end = agent.completedAt === undefined ? now : Date.parse(agent.completedAt);
  const span = end - start;
  return Number.isFinite(span) && span > 0 ? span : 0;
};

export const boardInputsOf = ({
  agents,
  questions,
  views,
  rootTurns,
  ownSpendByAgentId,
  now,
}: Params): BoardInputs => {
  const live = agents.filter((agent) => agent.deletedAt === undefined);
  const agentById = new Map<AgentId, Agent>(live.map((agent) => [agent.id, agent]));
  const rootIds = new Set<AgentId>(views.map((view) => view.tree.rootAgentId));
  const leadIdOf = ({ id }: IdParams): string | null => {
    const seen = new Set<AgentId>();
    let cursor: AgentId | undefined = id;
    while (cursor !== undefined && !seen.has(cursor)) {
      if (rootIds.has(cursor)) {
        return cursor;
      }
      seen.add(cursor);
      cursor = agentById.get(cursor)?.parentAgentId;
    }
    return null;
  };
  const leads = views.flatMap((view): ReadonlyArray<BoardLead> => {
    const root = agentById.get(view.tree.rootAgentId);
    if (root === undefined) {
      return [];
    }
    const { lead } = autoTreeWordOf({ view, rootTurn: rootTurns[root.id] ?? null });
    const isFailed = lead.reason === 'failed';
    return [
      {
        id: root.id,
        primaryMountId: view.tree.primaryMountId ?? root.mountId ?? null,
        spendUsd: ownSpendByAgentId.get(root.id) ?? 0,
        elapsedMs: elapsedOf({ agent: root, now }),
        isRunning: lead.stop === 'working',
        isBlocked: lead.stop === 'waitsForYou' && !isFailed,
        isFailed,
      },
    ];
  });
  const boardAgents = live
    .filter((agent) => !rootIds.has(agent.id))
    .map((agent): BoardAgent => ({
      id: agent.id,
      leadId: leadIdOf({ id: agent.id }),
      mountId: agent.mountId ?? null,
      spendUsd: ownSpendByAgentId.get(agent.id) ?? 0,
      elapsedMs: elapsedOf({ agent, now }),
      isRunning: agent.status === 'running',
      isBlocked: agent.status === 'blocked',
      isFailed: agent.status === 'failed',
    }));
  const asks = questions
    .filter((question) => question.status === 'open')
    .map((question): BoardAsk => {
      const asker =
        question.createdByAgentId === undefined
          ? undefined
          : agentById.get(question.createdByAgentId);
      return {
        id: question.id,
        mountId: asker?.mountId ?? null,
        leadId: asker === undefined ? null : leadIdOf({ id: asker.id }),
      };
    });
  return { agents: boardAgents, asks, leads };
};
