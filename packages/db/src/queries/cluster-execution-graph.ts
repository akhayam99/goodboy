import type {
  AgentId,
  ClusterExecutionGraph,
  ClusterExecutionNode,
  ClusterGraph,
  ClusterGraphNode,
  ClusterNodeResultState,
  ClusterNodeState,
  IsoDateTime,
  PlanClusterRole,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  CLUSTER_NODE_RESULT_STATES,
  CLUSTER_NODE_STATES,
  PLAN_CLUSTER_ROLES,
} from '@goodboy/types';
import type { Database } from '../client';

type GraphRow = {
  readonly container_agent_id: AgentId;
  readonly session_id: SessionId;
  readonly workflow_run_id: WorkflowRunId | null;
  readonly plan_id: string | null;
  readonly goal_title: string;
  readonly execution_version: number;
  readonly graph_json: string;
  readonly revision: number;
  readonly frozen_reason: string | null;
  readonly frozen_obligation_id: string | null;
  readonly created_at: number;
};

type NodeRow = {
  readonly container_agent_id: AgentId;
  readonly node_id: string;
  readonly agent_id: AgentId | null;
  readonly ordinal: number;
  readonly role: string;
  readonly state: string;
  readonly superseded_by: string | null;
  readonly revision: number;
  readonly result_state: string;
};

const toNodeState = ({ value }: { readonly value: string }): ClusterNodeState =>
  CLUSTER_NODE_STATES.find((state) => state === value) ?? 'active';

const toResultState = ({ value }: { readonly value: string }): ClusterNodeResultState =>
  CLUSTER_NODE_RESULT_STATES.find((state) => state === value) ?? 'pending';

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
      state: toNodeState({ value: node.state }),
      supersededBy: node.superseded_by,
      revision: node.revision,
      resultState: toResultState({ value: node.result_state }),
    })),
  revision: row.revision,
  frozenReason: row.frozen_reason,
  frozenObligationId: row.frozen_obligation_id,
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
});

export type ClusterExecutionNodeSeed = Readonly<{
  nodeId: string;
  agentId: AgentId | null;
  ordinal: number;
  role: PlanClusterRole;
}>;

type RecordParams = {
  readonly db: Database;
  readonly snapshot: Readonly<{
    containerAgentId: AgentId;
    sessionId: SessionId;
    workflowRunId: WorkflowRunId | null;
    planId: string | null;
    goalTitle: string;
    graph: ClusterGraph;
    nodes: ReadonlyArray<ClusterExecutionNodeSeed>;
  }>;
};

export const recordClusterExecutionGraph = async ({
  db,
  snapshot,
}: RecordParams): Promise<ClusterExecutionGraph> => {
  const now = Date.now();
  await db.execute(
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
  for (const node of snapshot.nodes) {
    await db.execute(
      `INSERT OR IGNORE INTO cluster_execution_nodes
         (container_agent_id, node_id, agent_id, ordinal, role, state, superseded_by, revision,
          result_state)
       VALUES (?, ?, ?, ?, ?, 'active', NULL, 1, 'pending')`,
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
    `SELECT n.container_agent_id, n.node_id, n.agent_id, n.ordinal, n.role, n.state,
            n.superseded_by, n.revision, n.result_state
       FROM cluster_execution_nodes n
       JOIN cluster_execution_graphs g ON g.container_agent_id = n.container_agent_id
      WHERE g.session_id = ?
      ORDER BY n.ordinal ASC`,
    [sessionId],
  );
  return rows.map((row) => toDomain({ row, nodes }));
};

export type FreezeClusterExecutionGraphParams = {
  readonly db: Database;
  readonly containerAgentId: AgentId;
  readonly reason: string;
  readonly obligationId: string | null;
};

export const freezeClusterExecutionGraph = async ({
  db,
  containerAgentId,
  reason,
  obligationId,
}: FreezeClusterExecutionGraphParams): Promise<ClusterExecutionGraph | null> => {
  await db.execute(
    `UPDATE cluster_execution_graphs
        SET frozen_reason = ?, frozen_obligation_id = COALESCE(?, frozen_obligation_id)
      WHERE container_agent_id = ? AND frozen_reason IS NULL`,
    [reason, obligationId, containerAgentId],
  );
  return getClusterExecutionGraph({ db, containerAgentId });
};

export type AdoptClusterGraphRevisionParams = {
  readonly db: Database;
  readonly revision: Readonly<{
    id: string;
    containerAgentId: AgentId;
    obligationId: string | null;
    fromRevision: number;
    toRevision: number;
    reason: string;
    graph: ClusterGraph;
    nodes: ReadonlyArray<ClusterExecutionNode>;
  }>;
};

export type ClusterGraphRevisionOutcome =
  | Readonly<{ kind: 'adopted'; graph: ClusterExecutionGraph }>
  | Readonly<{ kind: 'stale'; graph: ClusterExecutionGraph | null }>;

export const adoptClusterGraphRevision = async ({
  db,
  revision,
}: AdoptClusterGraphRevisionParams): Promise<ClusterGraphRevisionOutcome> => {
  const now = Date.now();
  await db.exec('BEGIN');
  try {
    const claimed = await db.execute(
      `UPDATE cluster_execution_graphs
          SET graph_json = ?, execution_version = ?, revision = ?, frozen_reason = NULL,
              frozen_obligation_id = NULL
        WHERE container_agent_id = ? AND revision = ?`,
      [
        JSON.stringify(revision.graph.nodes),
        revision.graph.executionVersion,
        revision.toRevision,
        revision.containerAgentId,
        revision.fromRevision,
      ],
    );
    if (claimed.rowsAffected === 0) {
      await db.exec('ROLLBACK');
      return {
        kind: 'stale',
        graph: await getClusterExecutionGraph({ db, containerAgentId: revision.containerAgentId }),
      };
    }
    for (const node of revision.nodes) {
      await db.execute(
        `INSERT INTO cluster_execution_nodes
           (container_agent_id, node_id, agent_id, ordinal, role, state, superseded_by, revision,
            result_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (container_agent_id, node_id) DO UPDATE SET
           agent_id = excluded.agent_id,
           ordinal = excluded.ordinal,
           role = excluded.role,
           state = excluded.state,
           superseded_by = excluded.superseded_by,
           revision = excluded.revision,
           result_state = excluded.result_state`,
        [
          revision.containerAgentId,
          node.nodeId,
          node.agentId,
          node.ordinal,
          node.role,
          node.state,
          node.supersededBy,
          node.revision,
          node.resultState,
        ],
      );
    }
    await db.execute(
      `INSERT OR IGNORE INTO cluster_graph_revisions
         (id, container_agent_id, obligation_id, from_revision, to_revision, state, reason,
          created_at)
       VALUES (?, ?, ?, ?, ?, 'adopted', ?, ?)`,
      [
        revision.id,
        revision.containerAgentId,
        revision.obligationId,
        revision.fromRevision,
        revision.toRevision,
        revision.reason,
        now,
      ],
    );
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
  const stored = await getClusterExecutionGraph({
    db,
    containerAgentId: revision.containerAgentId,
  });
  if (stored === null) {
    throw new Error(`cluster execution graph was not revised: ${revision.containerAgentId}`);
  }
  return { kind: 'adopted', graph: stored };
};

export type RefuseClusterGraphRevisionParams = {
  readonly db: Database;
  readonly id: string;
  readonly containerAgentId: AgentId;
  readonly obligationId: string | null;
  readonly fromRevision: number;
  readonly reason: string;
};

export const refuseClusterGraphRevision = async ({
  db,
  id,
  containerAgentId,
  obligationId,
  fromRevision,
  reason,
}: RefuseClusterGraphRevisionParams): Promise<void> => {
  await db.execute(
    `INSERT OR IGNORE INTO cluster_graph_revisions
       (id, container_agent_id, obligation_id, from_revision, to_revision, state, reason, created_at)
     VALUES (?, ?, ?, ?, ?, 'refused', ?, ?)`,
    [id, containerAgentId, obligationId, fromRevision, fromRevision, reason, Date.now()],
  );
};

export type ClusterGraphRevisionRecord = Readonly<{
  id: string;
  containerAgentId: AgentId;
  obligationId: string | null;
  fromRevision: number;
  toRevision: number;
  state: 'adopted' | 'refused';
  reason: string;
  createdAt: IsoDateTime;
}>;

type RevisionRow = {
  readonly id: string;
  readonly container_agent_id: AgentId;
  readonly obligation_id: string | null;
  readonly from_revision: number;
  readonly to_revision: number;
  readonly state: string;
  readonly reason: string;
  readonly created_at: number;
};

export const listClusterGraphRevisions = async ({
  db,
  containerAgentId,
}: {
  readonly db: Database;
  readonly containerAgentId: AgentId;
}): Promise<ReadonlyArray<ClusterGraphRevisionRecord>> => {
  const rows = await db.select<RevisionRow>(
    `SELECT id, container_agent_id, obligation_id, from_revision, to_revision, state, reason,
            created_at
       FROM cluster_graph_revisions WHERE container_agent_id = ? ORDER BY created_at ASC`,
    [containerAgentId],
  );
  return rows.map((row) => ({
    id: row.id,
    containerAgentId: row.container_agent_id,
    obligationId: row.obligation_id,
    fromRevision: row.from_revision,
    toRevision: row.to_revision,
    state: row.state === 'refused' ? 'refused' : 'adopted',
    reason: row.reason,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  }));
};
