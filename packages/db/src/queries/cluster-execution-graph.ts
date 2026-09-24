import type {
  AgentId,
  ClusterExecutionGraph,
  ClusterExecutionNode,
  ClusterGraph,
  ClusterGraphNode,
  IsoDateTime,
  PlanClusterRole,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { PLAN_CLUSTER_ROLES } from '@goodboy/types';
import type { Database } from '../client';

type GraphRow = {
  readonly container_agent_id: AgentId;
  readonly session_id: SessionId;
  readonly workflow_run_id: WorkflowRunId | null;
  readonly plan_id: string | null;
  readonly goal_title: string;
  readonly execution_version: number;
  readonly graph_json: string;
  readonly created_at: number;
};

type NodeRow = {
  readonly container_agent_id: AgentId;
  readonly node_id: string;
  readonly agent_id: AgentId | null;
  readonly ordinal: number;
  readonly role: string;
};

const ROLES: ReadonlySet<string> = new Set<string>(PLAN_CLUSTER_ROLES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toRole = ({ value }: { readonly value: string }): PlanClusterRole => {
  const match = PLAN_CLUSTER_ROLES.find((role) => role === value);
  return match ?? 'implementer';
};

const parseGraphNodes = ({
  value,
}: {
  readonly value: string;
}): ReadonlyArray<ClusterGraphNode> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const nodes: ClusterGraphNode[] = [];
  for (const entry of parsed) {
    if (!isRecord(entry)) {
      continue;
    }
    const id = typeof entry.id === 'string' ? entry.id : '';
    const role =
      typeof entry.role === 'string' && ROLES.has(entry.role) ? entry.role : 'implementer';
    if (id.length === 0) {
      continue;
    }
    nodes.push({
      id,
      ordinal: typeof entry.ordinal === 'number' ? entry.ordinal : nodes.length,
      title: typeof entry.title === 'string' ? entry.title : '',
      instructions: typeof entry.instructions === 'string' ? entry.instructions : '',
      role: toRole({ value: role }),
      dependsOn: Array.isArray(entry.dependsOn)
        ? entry.dependsOn.filter((dep): dep is string => typeof dep === 'string')
        : [],
      expectedOutput: typeof entry.expectedOutput === 'string' ? entry.expectedOutput : null,
    });
  }
  return nodes;
};

const toDomain = ({
  row,
  nodes,
}: {
  readonly row: GraphRow;
  readonly nodes: ReadonlyArray<NodeRow>;
}): ClusterExecutionGraph => ({
  containerAgentId: row.container_agent_id,
  sessionId: row.session_id,
  workflowRunId: row.workflow_run_id,
  planId: row.plan_id,
  goalTitle: row.goal_title,
  graph: {
    executionVersion: row.execution_version,
    nodes: parseGraphNodes({ value: row.graph_json }),
  },
  nodes: nodes
    .filter((node) => node.container_agent_id === row.container_agent_id)
    .map((node): ClusterExecutionNode => ({
      nodeId: node.node_id,
      agentId: node.agent_id,
      ordinal: node.ordinal,
      role: toRole({ value: node.role }),
    })),
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
});

type RecordParams = {
  readonly db: Database;
  readonly snapshot: Readonly<{
    containerAgentId: AgentId;
    sessionId: SessionId;
    workflowRunId: WorkflowRunId | null;
    planId: string | null;
    goalTitle: string;
    graph: ClusterGraph;
    nodes: ReadonlyArray<ClusterExecutionNode>;
  }>;
};

export const recordClusterExecutionGraph = async ({
  db,
  snapshot,
}: RecordParams): Promise<ClusterExecutionGraph> => {
  const now = Date.now();
  const created = await db.execute(
    `INSERT OR IGNORE INTO cluster_execution_graphs
       (container_agent_id, session_id, workflow_run_id, plan_id, goal_title,
        execution_version, graph_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshot.containerAgentId,
      snapshot.sessionId,
      snapshot.workflowRunId,
      snapshot.planId,
      snapshot.goalTitle,
      snapshot.graph.executionVersion,
      JSON.stringify(snapshot.graph.nodes),
      now,
    ],
  );
  const nodesToRecord = created.rowsAffected === 1 ? snapshot.nodes : [];
  for (const node of nodesToRecord) {
    await db.execute(
      `INSERT OR IGNORE INTO cluster_execution_nodes
         (container_agent_id, node_id, agent_id, ordinal, role)
       VALUES (?, ?, ?, ?, ?)`,
      [snapshot.containerAgentId, node.nodeId, node.agentId, node.ordinal, node.role],
    );
  }
  const stored = await getClusterExecutionGraph({
    db,
    containerAgentId: snapshot.containerAgentId,
  });
  if (stored === null) {
    throw new Error(`cluster execution graph was not recorded: ${snapshot.containerAgentId}`);
  }
  return stored;
};

export const getClusterExecutionGraph = async ({
  db,
  containerAgentId,
}: {
  readonly db: Database;
  readonly containerAgentId: AgentId;
}): Promise<ClusterExecutionGraph | null> => {
  const rows = await db.select<GraphRow>(
    'SELECT * FROM cluster_execution_graphs WHERE container_agent_id = ?',
    [containerAgentId],
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  const nodes = await db.select<NodeRow>(
    'SELECT * FROM cluster_execution_nodes WHERE container_agent_id = ? ORDER BY ordinal ASC',
    [containerAgentId],
  );
  return toDomain({ row, nodes });
};

export const listClusterExecutionGraphs = async ({
  db,
  sessionId,
}: {
  readonly db: Database;
  readonly sessionId: SessionId;
}): Promise<ReadonlyArray<ClusterExecutionGraph>> => {
  const rows = await db.select<GraphRow>(
    'SELECT * FROM cluster_execution_graphs WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
  const nodes = await db.select<NodeRow>(
    `SELECT n.container_agent_id, n.node_id, n.agent_id, n.ordinal, n.role
       FROM cluster_execution_nodes n
       JOIN cluster_execution_graphs g ON g.container_agent_id = n.container_agent_id
      WHERE g.session_id = ?
      ORDER BY n.ordinal ASC`,
    [sessionId],
  );
  return rows.map((row) => toDomain({ row, nodes }));
};
