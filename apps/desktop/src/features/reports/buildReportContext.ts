import type {
  Agent,
  IsoDateTime,
  SessionArtifact,
  SessionEvent,
  Session,
  TurnEvent,
  WorkflowRunId,
} from '@goodboy/types';
import { redactSecrets } from '../../shared/utils/redactSecrets';
import { ARTIFACT_BRIEF_CLIP_NOTE, clipBrief } from '../artifacts/artifactBrief';
import {
  briefInventoryRow,
  excludedInventoryRow,
  keptRowState,
  sizeInventoryRow,
  type ArtifactContextInventoryRow,
} from '../artifacts/artifactContextInventory';
import type { ScriptRunRecord } from '../scripts/scripts';
import { REPORT_TYPE_HINT, REPORT_TYPE_LABEL, type ReportType } from './reportTypes';

export const REPORT_CONTEXT_LIMITS = {
  agents: 12,
  agentText: 1200,
  artifacts: 10,
  artifactExcerpt: 400,
  events: 20,
  commits: 20,
  paths: 40,
  scriptRuns: 10,
  total: 48_000,
} as const;

export type ReportDiffUnavailableReason = 'no-mount' | 'unreadable';

export const REPORT_DEFAULT_REQUEST = ({
  reportType,
}: {
  readonly reportType: ReportType;
}): string =>
  `write a ${REPORT_TYPE_LABEL[reportType].toLowerCase()}: ${REPORT_TYPE_HINT[reportType]}.`;

export const REPORT_EXCLUDED_COPY =
  'never sent: tool calls, tool output, transcripts beyond the last message, open questions, decisions, review threads, the session summary, other mounts';

export type ReportDiffEvidence = Readonly<{
  mountName: string;
  baseBranch: string;
  headSha: string | null;
  commits: ReadonlyArray<Readonly<{ sha: string; subject: string }>>;
  additions: number;
  deletions: number;
  paths: ReadonlyArray<string>;
}>;

export type ReportContextParams = Readonly<{
  reportType: ReportType;
  brief?: string | null;
  session: Session;
  agents: ReadonlyArray<Agent>;
  transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  artifacts: ReadonlyArray<SessionArtifact>;
  events: ReadonlyArray<SessionEvent>;
  scriptRuns: Readonly<Record<string, ScriptRunRecord>>;
  diff: ReportDiffEvidence | null;
  diffUnavailableReason?: ReportDiffUnavailableReason | null;
  workflowRunId: WorkflowRunId | null;
  capturedAt: IsoDateTime;
}>;

export type ReportContext = Readonly<{
  text: string;
  sourceIds: ReadonlyArray<string>;
  truncations: ReadonlyArray<string>;
  inventory: ReadonlyArray<ArtifactContextInventoryRow>;
}>;

type ClipParams = Readonly<{ text: string; limit: number }>;

const clip = ({
  text,
  limit,
}: ClipParams): { readonly text: string; readonly isClipped: boolean } => {
  const collapsed = text.trim();
  if (collapsed.length <= limit) {
    return { text: collapsed, isClipped: false };
  }
  return { text: `${collapsed.slice(0, limit)}...`, isClipped: true };
};

const lastAssistantText = ({
  events,
}: {
  readonly events: ReadonlyArray<TurnEvent>;
}): string | null => {
  const lastRunId = [...events].reverse().find((event) => event.kind === 'assistant_text')?.runId;
  if (lastRunId === undefined) {
    return null;
  }
  const joined = events
    .filter((event) => event.kind === 'assistant_text' && event.runId === lastRunId)
    .map((event) => (event.kind === 'assistant_text' ? event.delta : ''))
    .join('');
  const trimmed = joined.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const scopedAgents = ({
  agents,
  workflowRunId,
}: Pick<ReportContextParams, 'agents' | 'workflowRunId'>): ReadonlyArray<Agent> => {
  const scoped =
    workflowRunId === null
      ? agents
      : agents.filter((agent) => agent.workflowRunId === workflowRunId);
  return [...scoped].sort((left, right) => left.ordinal - right.ordinal);
};

const scopedArtifacts = ({
  artifacts,
  workflowRunId,
}: Pick<ReportContextParams, 'artifacts' | 'workflowRunId'>): ReadonlyArray<SessionArtifact> => {
  if (workflowRunId === null) {
    return artifacts;
  }
  return artifacts.filter((artifact) => artifact.workflowRunId === workflowRunId);
};

const agentSection = ({
  agents,
  transcripts,
  truncations,
  sourceIds,
  inventory,
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly transcripts: ReportContextParams['transcripts'];
  readonly truncations: Array<string>;
  readonly sourceIds: Array<string>;
  readonly inventory: Array<ArtifactContextInventoryRow>;
}): string => {
  if (agents.length === 0) {
    inventory.push({
      id: 'agents',
      label: 'agents',
      summary: 'no agent has run in this scope',
      state: 'missing',
      detail: [],
    });
    return '## agents\n\nno agents ran in this scope.';
  }
  const kept = agents.slice(-REPORT_CONTEXT_LIMITS.agents);
  if (kept.length < agents.length) {
    truncations.push(
      `agents: kept the last ${kept.length} of ${agents.length}; earlier agents are missing`,
    );
  }
  let silent = 0;
  const rows = kept.map((agent) => {
    sourceIds.push(agent.id);
    const events = transcripts[agent.id] ?? [];
    const text = lastAssistantText({ events });
    if (text === null) {
      silent += 1;
      return `### ${redactSecrets({ text: agent.name })} (agent ${agent.id}, ${agent.status})\n\nno assistant output recorded.`;
    }
    const clipped = clip({ text: redactSecrets({ text }), limit: REPORT_CONTEXT_LIMITS.agentText });
    if (clipped.isClipped) {
      truncations.push(`agent ${agent.id}: final message truncated`);
    }
    return `### ${redactSecrets({ text: agent.name })} (agent ${agent.id}, ${agent.status})\n\n${clipped.text}`;
  });
  inventory.push({
    id: 'agents',
    label: 'agents',
    summary: `${kept.length} of ${agents.length} agents, last message of each up to ${REPORT_CONTEXT_LIMITS.agentText} characters`,
    state: keptRowState({ kept: kept.length, total: agents.length }),
    detail: [
      ...(kept.length < agents.length
        ? [`only the last ${REPORT_CONTEXT_LIMITS.agents} fit, earlier agents are missing`]
        : []),
      ...(silent > 0 ? [`${silent} had no output recorded`] : []),
    ],
  });
  return `## agents\n\n${rows.join('\n\n')}`;
};

const artifactSection = ({
  artifacts,
  truncations,
  sourceIds,
  inventory,
}: {
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly truncations: Array<string>;
  readonly sourceIds: Array<string>;
  readonly inventory: Array<ArtifactContextInventoryRow>;
}): string => {
  if (artifacts.length === 0) {
    inventory.push({
      id: 'artifacts',
      label: 'artifacts',
      summary: 'no plan, report or wireframe in this scope',
      state: 'missing',
      detail: [],
    });
    return '## artifacts\n\nno plans, reports or wireframes were captured in this scope.';
  }
  const kept = artifacts.slice(-REPORT_CONTEXT_LIMITS.artifacts);
  if (kept.length < artifacts.length) {
    truncations.push(
      `artifacts: kept the last ${kept.length} of ${artifacts.length}; earlier artifacts are missing`,
    );
  }
  const rows = kept.map((artifact) => {
    sourceIds.push(artifact.id);
    const excerpt = clip({
      text: redactSecrets({ text: artifact.sourceText }),
      limit: REPORT_CONTEXT_LIMITS.artifactExcerpt,
    });
    if (excerpt.isClipped) {
      truncations.push(`artifact ${artifact.id}: source truncated`);
    }
    const title = redactSecrets({ text: artifact.title });
    return `- ${artifact.kind} ${artifact.id} rev ${artifact.revision} (${artifact.status}) "${title}"\n  ${excerpt.text.replace(/\n/g, '\n  ')}`;
  });
  inventory.push({
    id: 'artifacts',
    label: 'artifacts',
    summary: `${kept.length} of ${artifacts.length} artifacts, first ${REPORT_CONTEXT_LIMITS.artifactExcerpt} characters of each, discarded ones included`,
    state: keptRowState({ kept: kept.length, total: artifacts.length }),
    detail:
      kept.length < artifacts.length
        ? [`only the last ${REPORT_CONTEXT_LIMITS.artifacts} fit, earlier artifacts are missing`]
        : [],
  });
  return `## artifacts\n\n${rows.join('\n')}`;
};

const diffSection = ({
  diff,
  reason,
  inventory,
}: {
  readonly diff: ReportDiffEvidence | null;
  readonly reason: ReportDiffUnavailableReason | null;
  readonly inventory: Array<ArtifactContextInventoryRow>;
}): string => {
  if (diff === null) {
    inventory.push({
      id: 'diff',
      label: 'local change',
      summary: reason === 'unreadable' ? 'the worktree could not be read' : 'no mounted project',
      state: 'missing',
      detail: [],
    });
    return '## diff\n\nno mount diff was available at capture time.';
  }
  const commits = diff.commits
    .slice(0, REPORT_CONTEXT_LIMITS.commits)
    .map((commit) => `- ${commit.sha} ${redactSecrets({ text: commit.subject })}`)
    .join('\n');
  const paths = diff.paths
    .slice(0, REPORT_CONTEXT_LIMITS.paths)
    .map((path) => `- ${path}`)
    .join('\n');
  const head = diff.headSha ?? 'unknown';
  inventory.push({
    id: 'diff',
    label: 'local change',
    summary: `${diff.mountName} against ${diff.baseBranch}: ${diff.commits.length} commits, ${diff.paths.length} files, +${diff.additions} -${diff.deletions}`,
    state: 'included',
    detail: ['file paths and commit subjects only, no file contents'],
  });
  return [
    '## diff',
    '',
    `mount ${redactSecrets({ text: diff.mountName })}, base ${redactSecrets({ text: diff.baseBranch })}, head ${head}, +${diff.additions} -${diff.deletions}, ${diff.paths.length} files`,
    '',
    commits.length === 0 ? 'no commits recorded.' : `commits:\n${commits}`,
    '',
    paths.length === 0 ? 'no changed files recorded.' : `changed files:\n${paths}`,
  ].join('\n');
};

const scriptSection = ({
  scriptRuns,
  inventory,
}: {
  readonly scriptRuns: ReportContextParams['scriptRuns'];
  readonly inventory: Array<ArtifactContextInventoryRow>;
}): string => {
  const rows = Object.entries(scriptRuns)
    .filter(([, record]) => record.status === 'ok' || record.status === 'error')
    .slice(0, REPORT_CONTEXT_LIMITS.scriptRuns)
    .map(([scriptId, record]) => {
      const exitCode = record.result?.exitCode ?? null;
      const exit = exitCode === null ? 'no exit code' : `exit ${exitCode}`;
      return `- ${redactSecrets({ text: record.name ?? scriptId })}: ${record.status}, ${exit}`;
    });
  if (rows.length === 0) {
    inventory.push({
      id: 'checks',
      label: 'checks',
      summary: 'no script run recorded',
      state: 'missing',
      detail: [],
    });
    return '## checks\n\nno script or test run outcome was recorded in this session.';
  }
  inventory.push({
    id: 'checks',
    label: 'checks',
    summary: `${rows.length} script runs with an outcome, exit codes only`,
    state: 'included',
    detail: ['scripts you ran from this session, not CI'],
  });
  return `## checks\n\n${rows.join('\n')}`;
};

const eventSection = ({
  events,
  truncations,
  inventory,
}: {
  readonly events: ReadonlyArray<SessionEvent>;
  readonly truncations: Array<string>;
  readonly inventory: Array<ArtifactContextInventoryRow>;
}): string => {
  if (events.length === 0) {
    inventory.push({
      id: 'events',
      label: 'session events',
      summary: 'no session event recorded',
      state: 'missing',
      detail: [],
    });
    return '## session events\n\nno session events were recorded.';
  }
  const kept = events.slice(-REPORT_CONTEXT_LIMITS.events);
  if (kept.length < events.length) {
    truncations.push(
      `session events: kept the last ${kept.length} of ${events.length}; earlier events are missing`,
    );
  }
  const rows = kept.map((event) => `- ${event.createdAt} ${event.kind}`);
  inventory.push({
    id: 'events',
    label: 'session events',
    summary: `last ${kept.length} of ${events.length} session events, kind and time only`,
    state: keptRowState({ kept: kept.length, total: events.length }),
    detail: [],
  });
  return `## session events\n\n${rows.join('\n')}`;
};

export const buildReportContext = ({
  reportType,
  brief = null,
  session,
  agents,
  transcripts,
  artifacts,
  events,
  scriptRuns,
  diff,
  diffUnavailableReason = null,
  workflowRunId,
  capturedAt,
}: ReportContextParams): ReportContext => {
  const truncations: Array<string> = [];
  const sourceIds: Array<string> = [session.id];
  const inventory: Array<ArtifactContextInventoryRow> = [];
  const request = clipBrief({ text: brief ?? '' });
  if (request.isClipped) {
    truncations.push(ARTIFACT_BRIEF_CLIP_NOTE);
  }
  const scopedAgentList = scopedAgents({ agents, workflowRunId });
  const scopedArtifactList = scopedArtifacts({ artifacts, workflowRunId });
  const scope = workflowRunId === null ? 'the whole session' : `workflow run ${workflowRunId}`;
  const header = [
    `# evidence pack: ${REPORT_TYPE_LABEL[reportType]}`,
    '',
    REPORT_DEFAULT_REQUEST({ reportType }),
    `scope: ${scope}. captured at ${capturedAt}.`,
    `session ${session.id}: ${redactSecrets({ text: session.goal })}`,
    '',
    'this pack is the only evidence you have. it carries final agent messages, not tool calls or tool output. never invent a fact that is not here; say plainly what is missing.',
  ].join('\n');

  if (workflowRunId !== null) {
    sourceIds.push(workflowRunId);
  }

  inventory.push(briefInventoryRow({ brief: request.text }));
  inventory.push({
    id: 'goal',
    label: 'goal',
    summary: 'the session goal and the report type',
    state: 'included',
    detail: [],
  });

  const body = [
    header,
    agentSection({ agents: scopedAgentList, transcripts, truncations, sourceIds, inventory }),
    artifactSection({ artifacts: scopedArtifactList, truncations, sourceIds, inventory }),
    diffSection({ diff, reason: diffUnavailableReason, inventory }),
    scriptSection({ scriptRuns, inventory }),
    eventSection({ events, truncations, inventory }),
  ].join('\n\n');

  const capped = clip({ text: body, limit: REPORT_CONTEXT_LIMITS.total });
  if (capped.isClipped) {
    truncations.push(`evidence pack capped at ${REPORT_CONTEXT_LIMITS.total} characters`);
  }
  const notes =
    truncations.length === 0
      ? '## truncation\n\nnothing was truncated.'
      : `## truncation\n\n${truncations.map((note) => `- ${note}`).join('\n')}`;

  const sections = [
    ...(request.text.length > 0
      ? [`# user request\n\n${redactSecrets({ text: request.text })}`]
      : []),
    `${capped.text}\n\n${notes}`,
  ];
  inventory.push(excludedInventoryRow({ summary: REPORT_EXCLUDED_COPY }));
  inventory.push(
    sizeInventoryRow({
      size: body.length,
      cap: REPORT_CONTEXT_LIMITS.total,
      isCapped: capped.isClipped,
    }),
  );
  return {
    text: sections.join('\n\n'),
    sourceIds,
    truncations,
    inventory,
  };
};
