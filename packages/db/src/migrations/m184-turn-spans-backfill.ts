const RUN_ID_SUFFIXES = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
] as const;

const COLLECT_RUN_AGENTS = `
CREATE TABLE IF NOT EXISTS m184_run_agents (
  run_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL
);

INSERT OR IGNORE INTO m184_run_agents (run_id, agent_id)
SELECT run_id, agent_id FROM (
  SELECT
    CASE
      WHEN instr(payload, '"done"') = 0 THEN NULL
      WHEN json_valid(payload) = 0 THEN NULL
      WHEN json_extract(payload, '$.kind') <> 'done' THEN NULL
      ELSE json_extract(payload, '$.runId')
    END AS run_id,
    agent_id
  FROM turn_events
)
WHERE run_id IS NOT NULL AND typeof(run_id) = 'text';

INSERT OR IGNORE INTO m184_run_agents (run_id, agent_id)
SELECT provider_run_id, id FROM agents WHERE provider_run_id IS NOT NULL
`;

type ChunkParams = {
  readonly runIdFilter: string;
};

const backfillChunk = ({ runIdFilter }: ChunkParams): string => `
INSERT INTO agent_turn_spans
  (run_id, agent_id, session_id, workspace_id, workflow_run_id, step_role, provider, model, effort, started_at, ended_at, end_reason, cost_usd)
SELECT run_id, agent_id, session_id, workspace_id, workflow_run_id, step_role, provider, model, NULL, started_at, ended_at, 'succeeded', cost_usd
FROM (
  SELECT
    pr.id AS run_id,
    a.id AS agent_id,
    s.id AS session_id,
    s.workspace_id AS workspace_id,
    w.workflow_run_id AS workflow_run_id,
    COALESCE(
      st.role,
      CASE COALESCE(a.kind, 'generic')
        WHEN 'scout' THEN 'scout'
        WHEN 'planner' THEN 'planner'
        WHEN 'implementer' THEN 'implementer'
        WHEN 'debugger' THEN 'investigator'
        WHEN 'tester' THEN 'tester'
        WHEN 'reviewer' THEN 'reviewer'
        WHEN 'pr-reviewer' THEN 'reviewer'
        WHEN 'docs' THEN 'docs'
        WHEN 'report' THEN 'report'
        WHEN 'wireframe' THEN 'wireframe'
        WHEN 'resolver' THEN 'resolver'
        ELSE 'custom'
      END
    ) AS step_role,
    pr.provider AS provider,
    pr.model AS model,
    pr.created_at AS started_at,
    CASE
      WHEN json_valid(pr.status_payload) = 0 THEN NULL
      WHEN typeof(json_extract(pr.status_payload, '$.finishedAt')) IN ('integer', 'real')
        THEN CAST(json_extract(pr.status_payload, '$.finishedAt') AS INTEGER)
      WHEN typeof(json_extract(pr.status_payload, '$.finishedAt')) = 'text'
        THEN CAST(ROUND((julianday(json_extract(pr.status_payload, '$.finishedAt')) - 2440587.5) * 86400000) AS INTEGER)
      ELSE NULL
    END AS ended_at,
    (SELECT SUM(t.estimated_cost_usd) FROM telemetry_records t WHERE t.run_id = pr.id) AS cost_usd
  FROM provider_runs pr
  JOIN m184_run_agents ra ON ra.run_id = pr.id
  JOIN agents a ON a.id = ra.agent_id
  JOIN sessions s ON s.id = pr.session_id
  LEFT JOIN steps st ON st.id = a.step_id
  LEFT JOIN session_workflows w ON w.workflow_run_id = a.workflow_run_id
  WHERE pr.status_kind = 'succeeded' AND ${runIdFilter}
)
WHERE ended_at IS NOT NULL AND ended_at >= started_at
ON CONFLICT (run_id) DO NOTHING
`;

const suffixList = RUN_ID_SUFFIXES.map((suffix) => `'${suffix}'`).join(', ');

const CHUNKS = [
  ...RUN_ID_SUFFIXES.map((suffix) =>
    backfillChunk({ runIdFilter: `substr(pr.id, -1) = '${suffix}'` }),
  ),
  `${backfillChunk({ runIdFilter: `substr(pr.id, -1) NOT IN (${suffixList})` })};

DROP TABLE IF EXISTS m184_run_agents`,
];

export const m184TurnSpansBackfill = [COLLECT_RUN_AGENTS, ...CHUNKS].join(`;

PRAGMA foreign_keys = ON;
`);
