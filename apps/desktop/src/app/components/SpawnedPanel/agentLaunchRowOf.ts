import type { Agent } from '@goodboy/types';
import type { AgentKind } from '../../../features/session/agent-kind';
import type { AgentState } from '../../../features/workTreeModel/agentStateOf';
import { rowStateTone } from '../../../features/workTreeModel/rowStateCopy';
import { runAgentCardOf } from './runAgentCardOf';
import type { SpawnedRow } from './spawnedRow';

type Params = {
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly state: AgentState;
};

export const agentLaunchRowOf = ({ agent, kind, state }: Params): SpawnedRow => ({
  id: agent.id,
  agentId: agent.id,
  level: 1,
  hasChildren: false,
  title: agent.name,
  card: runAgentCardOf({
    name: agent.name,
    kind,
    tone: rowStateTone({ state: state.row }),
    word: state.word,
    isRunning: state.row.phase === 'running',
  }),
  role: kind,
  node: state.node.state,
  word: state.word,
  isLive: state.row.phase === 'running',
  model: { agent, routing: null },
});
