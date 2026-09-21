import { parseWireframeSource } from '@goodboy/core';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionArtifact,
  SessionEvent,
  Session,
  TurnEvent,
  WorkflowRunId,
} from '@goodboy/types';
import { redactSecrets } from '../../shared/utils/redactSecrets';
import {
  allocateReportContext,
  clipToBoundary,
  fitWithinBudget,
  REPORT_ALLOCATION_LIMITS,
  type BudgetBlock,
  type ReportAgentCandidate,
} from './allocateReportContext';
import { ARTIFACT_BRIEF_CLIP_NOTE, clipBrief, formatBriefCount } from '../artifacts/artifactBrief';
import {
  artifactAttachmentsSection,
  attachmentsInventoryRow,
  type ArtifactAttachment,
} from '../artifacts/artifactAttachments';
import { artifactQuestionContract } from '../artifacts/artifactQuestionContract';
import {
  briefInventoryRow,
  excludedInventoryRow,
  keptRowState,
  sizeInventoryRow,
  type ArtifactContextInventoryRow,
} from '../artifacts/artifactContextInventory';
import { SESSION_GOAL_CLIP_NOTE, type SessionGoalText } from '../artifacts/sessionGoalText';
import type { ScriptRunRecord } from '../scripts/scripts';
import { buildWireframeIndex } from '../wireframes/wireframeIndex';
import { buildReportOutline } from './reportOutline';
import { REPORT_TYPE_HINT, REPORT_TYPE_LABEL, type ReportType } from './reportTypes';

export const REPORT_CONTEXT_LIMITS = {
  agents: 12,
  artifacts: 10,
  artifactExcerpt: 400,
  artifactHeadings: 12,
  artifactTransitions: 20,
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

export const REPORT_NO_SCOUT_COPY = 'no scout read a repository for this report';

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

export type ReportScoutEvidence = Readonly<{
  names: ReadonlyArray<string>;
  section: string | null;
  note: string | null;
}>;

export type ReportContextParams = Readonly<{
  reportType: ReportType;
  brief?: string | null;
  attachments: ReadonlyArray<ArtifactAttachment>;
  session: Session;
  goal: SessionGoalText;
  agents: ReadonlyArray<Agent>;
  transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  artifacts: ReadonlyArray<SessionArtifact>;
  events: ReadonlyArray<SessionEvent>;
  scriptRuns: Readonly<Record<string, ScriptRunRecord>>;
  diff: ReportDiffEvidence | null;
  diffUnavailableReason?: ReportDiffUnavailableReason | null;
  scouts?: ReportScoutEvidence | null;
  workflowRunId: WorkflowRunId | null;
  capturedAt: IsoDateTime;
}>;

export type ReportContext = Readonly<{
  text: string;
  sourceIds: ReadonlyArray<string>;
  truncations: ReadonlyArray<string>;
  inventory: ReadonlyArray<ArtifactContextInventoryRow>;
}>;

const isAssistantTextEvent = (
  event: TurnEvent,
): event is Extract<TurnEvent, { kind: 'assistant_text' }> => event.kind === 'assistant_text';

type AssistantMessage = Readonly<{ text: string; at: IsoDateTime }>;

const lastAssistantMessage = ({
  events,
}: {
  readonly events: ReadonlyArray<TurnEvent>;
}): AssistantMessage | null => {
  const assistantEvents = events.filter(isAssistantTextEvent);
  const lastEvent = assistantEvents[assistantEvents.length - 1];
  if (lastEvent === undefined) {
    return null;
  }
  const grouped = assistantEvents.filter((event) => event.runId === lastEvent.runId);
  const joined = grouped.map((event) => event.delta).join('');
  const trimmed = joined.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const last = grouped[grouped.length - 1];
  return { text: trimmed, at: last === undefined ? lastEvent.at : last.at };
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

type PreparedAgents =
  | Readonly<{ kind: 'empty' }>
  | Readonly<{
      kind: 'ready';
      kept: ReadonlyArray<Agent>;
      messages: ReadonlyMap<AgentId, AssistantMessage | null>;
      candidates: ReadonlyArray<ReportAgentCandidate>;
    }>;

const prepareAgents = ({
  agents,
  transcripts,
  truncations,
  sourceIds,
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly transcripts: ReportContextParams['transcripts'];
  readonly truncations: Array<string>;
  readonly sourceIds: Array<string>;
}): PreparedAgents => {
  if (agents.length === 0) {
    return { kind: 'empty' };
  }
  const kept = agents.slice(-REPORT_CONTEXT_LIMITS.agents);
  if (kept.length < agents.length) {
    truncations.push(
      `agents: kept the last ${kept.length} of ${agents.length}; earlier agents are missing`,
    );
  }
  const messages = new Map<AgentId, AssistantMessage | null>();
  kept.forEach((agent) => {
    sourceIds.push(agent.id);
    const events = transcripts[agent.id] ?? [];
    const message = lastAssistantMessage({ events });
    messages.set(
      agent.id,
      message === null ? null : { text: redactSecrets({ text: message.text }), at: message.at },
    );
  });
  const candidates: Array<ReportAgentCandidate> = [];
  kept.forEach((agent) => {
    const message = messages.get(agent.id);
    if (message === null || message === undefined) {
      return;
    }
    candidates.push({
      id: agent.id,
      ordinal: agent.ordinal,
      lastAssistantAt: message.at,
      textLength: message.text.length,
    });
  });
  return { kind: 'ready', kept, messages, candidates };
};

type RenderedAgents = Readonly<{ text: string; row: ArtifactContextInventoryRow }>;

const renderAgents = ({
  prepared,
  totalAgentCount,
  budgets,
  truncations,
}: {
  readonly prepared: PreparedAgents;
  readonly totalAgentCount: number;
  readonly budgets: ReadonlyMap<string, number>;
  readonly truncations: Array<string>;
}): RenderedAgents => {
  if (prepared.kind === 'empty') {
    return {
      text: '## agents\n\nno agents ran in this scope.',
      row: {
        id: 'agents',
        label: 'agents',
        summary: 'no agent has run in this scope',
        state: 'missing',
        detail: [],
      },
    };
  }
  const { kept, messages } = prepared;
  let silent = 0;
  let clippedCount = 0;
  const rows = kept.map((agent) => {
    const name = redactSecrets({ text: agent.name });
    const message = messages.get(agent.id);
    if (message === null || message === undefined) {
      silent += 1;
      return `### ${name} (agent ${agent.id}, ${agent.status})\n\nno assistant output recorded.`;
    }
    const budget = budgets.get(agent.id) ?? 0;
    const clipped = clipToBoundary({ text: message.text, limit: budget });
    if (clipped.isClipped) {
      clippedCount += 1;
      truncations.push(`agent ${agent.id}: final message truncated`);
    }
    return `### ${name} (agent ${agent.id}, ${agent.status})\n\n${clipped.text}`;
  });
  const state = kept.length < totalAgentCount || clippedCount > 0 ? 'partial' : 'included';
  return {
    text: `## agents\n\n${rows.join('\n\n')}`,
    row: {
      id: 'agents',
      label: 'agents',
      summary: `${kept.length} of ${totalAgentCount} agents, most recent final message given priority within a shared budget`,
      state,
      detail: [
        ...(kept.length < totalAgentCount
          ? [`only the last ${REPORT_CONTEXT_LIMITS.agents} fit, earlier agents are missing`]
          : []),
        ...(silent > 0 ? [`${silent} had no output recorded`] : []),
        ...(clippedCount > 0
          ? [`${clippedCount} final message(s) were shortened to fit the budget`]
          : []),
      ],
    },
  };
};

type ArtifactExcerptParams = Readonly<{ artifact: SessionArtifact }>;

type ArtifactExcerpt = Readonly<{
  text: string;
  isClipped: boolean;
  summary: string;
}>;

const artifactExcerpt = ({ artifact }: ArtifactExcerptParams): ArtifactExcerpt => {
  if (artifact.kind === 'wireframe') {
    const parsed = parseWireframeSource({ source: artifact.sourceText });
    if (parsed.status === 'valid') {
      const { document } = parsed;
      const index = buildWireframeIndex({ document });
      const titles = new Map(document.screens.map((screen) => [screen.id, screen.title]));
      const transitions = [
        ...new Set(
          [...index.actionByNodeId].flatMap(([nodeId, action]) => {
            if (action.type !== 'navigate') {
              return [];
            }
            const from = index.screenByNodeId.get(nodeId);
            if (from === undefined) {
              return [];
            }
            return [`${titles.get(from)} to ${titles.get(action.toScreenId)}`];
          }),
        ),
      ];
      const kept = transitions.slice(0, REPORT_CONTEXT_LIMITS.artifactTransitions);
      return {
        text: redactSecrets({
          text: `screens: ${document.screens.map((screen) => screen.title).join('; ')}.\ntransitions: ${kept.length === 0 ? 'none' : kept.join('; ')}.`,
        }),
        isClipped: kept.length < transitions.length,
        summary: `${document.screens.length} screen titles, ${kept.length} of ${transitions.length} transitions`,
      };
    }
  }
  if (artifact.kind === 'report') {
    const headings = buildReportOutline({ markdown: artifact.sourceText });
    if (headings.length > 0) {
      const kept = headings.slice(0, REPORT_CONTEXT_LIMITS.artifactHeadings);
      return {
        text: redactSecrets({
          text: `headings: ${kept.map((heading) => heading.title).join('; ')}`,
        }),
        isClipped: kept.length < headings.length,
        summary: `${kept.length} of ${headings.length} headings`,
      };
    }
  }
  const excerpt = clipToBoundary({
    text: redactSecrets({ text: artifact.sourceText }),
    limit: REPORT_CONTEXT_LIMITS.artifactExcerpt,
  });
  const reason =
    artifact.kind === 'wireframe'
      ? 'invalid wireframe, '
      : artifact.kind === 'report'
        ? 'no headings, '
        : '';
  return {
    ...excerpt,
    summary: `${reason}source excerpt up to ${REPORT_CONTEXT_LIMITS.artifactExcerpt} characters`,
  };
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
  const detail: Array<string> = [];
  let hasClippedExcerpt = false;
  const rows = kept.map((artifact) => {
    sourceIds.push(artifact.id);
    const excerpt = artifactExcerpt({ artifact });
    detail.push(`${artifact.kind} ${artifact.id}: ${excerpt.summary}`);
    if (excerpt.isClipped) {
      hasClippedExcerpt = true;
      truncations.push(`artifact ${artifact.id}: excerpt truncated`);
    }
    const title = redactSecrets({ text: artifact.title });
    return `- ${artifact.kind} ${artifact.id} rev ${artifact.revision} (${artifact.status}) "${title}"\n  ${excerpt.text.replace(/\n/g, '\n  ')}`;
  });
  inventory.push({
    id: 'artifacts',
    label: 'artifacts',
    summary: `${kept.length} of ${artifacts.length} artifacts, wireframe screens and transitions, report headings, source excerpts otherwise, discarded ones included`,
    state: hasClippedExcerpt
      ? 'partial'
      : keptRowState({ kept: kept.length, total: artifacts.length }),
    detail: [
      ...detail,
      ...(kept.length < artifacts.length
        ? [`only the last ${REPORT_CONTEXT_LIMITS.artifacts} fit, earlier artifacts are missing`]
        : []),
    ],
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

const scoutBlock = ({
  scouts,
  inventory,
}: {
  readonly scouts: ReportScoutEvidence | null;
  readonly inventory: Array<ArtifactContextInventoryRow>;
}): ReadonlyArray<string> => {
  if (scouts === null) {
    return [];
  }
  if (scouts.section === null) {
    inventory.push({
      id: 'scouts',
      label: 'scouts',
      summary: scouts.note ?? REPORT_NO_SCOUT_COPY,
      state: 'missing',
      detail: ['the report is written from the evidence in this pack alone'],
    });
    return [];
  }
  inventory.push({
    id: 'scouts',
    label: 'scouts',
    summary: `${scouts.names.length} scouts read the diff context in parallel, one turn each: ${scouts.names.join(', ')}`,
    state: 'included',
    detail: [],
  });
  return [scouts.section];
};

const renderTruncationNotes = (notes: ReadonlyArray<string>): string =>
  notes.length === 0
    ? '## truncation\n\nnothing was truncated.'
    : `## truncation\n\n${notes.map((note) => `- ${note}`).join('\n')}`;

type BodyPieceId =
  | 'header'
  | 'goal'
  | 'attachments'
  | 'agents'
  | 'artifacts'
  | 'diff'
  | 'scouts'
  | 'checks'
  | 'events';

type BodyPieces = Readonly<Record<BodyPieceId, string>>;

const BODY_ORDER: ReadonlyArray<BodyPieceId> = [
  'header',
  'goal',
  'attachments',
  'agents',
  'artifacts',
  'diff',
  'scouts',
  'checks',
  'events',
];

const FALLBACK_NOTE_MARGIN = 200;

const SHRINK_ORDER: ReadonlyArray<BodyPieceId> = [
  'events',
  'checks',
  'artifacts',
  'diff',
  'scouts',
  'agents',
];

const renderBody = (pieces: BodyPieces): string =>
  BODY_ORDER.map((id) => pieces[id])
    .filter((piece) => piece.length > 0)
    .join('\n\n');

export const buildReportContext = ({
  reportType,
  brief = null,
  attachments,
  session,
  goal,
  agents,
  transcripts,
  artifacts,
  events,
  scriptRuns,
  diff,
  diffUnavailableReason = null,
  scouts = null,
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
  if (goal.isClipped) {
    truncations.push(SESSION_GOAL_CLIP_NOTE);
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

  const goalBlockText = goal.isDetailed ? `## goal\n\n${goal.packText}` : '';

  if (workflowRunId !== null) {
    sourceIds.push(workflowRunId);
  }

  inventory.push(briefInventoryRow({ brief: request.text }));
  inventory.push(attachmentsInventoryRow({ attachments }));
  inventory.push({
    id: 'goal',
    label: 'goal',
    summary: 'the session goal and the report type',
    state: goal.isClipped ? 'partial' : 'included',
    detail: goal.isDetailed
      ? [`the goal you wrote, ${formatBriefCount({ value: goal.packText.length })} characters`]
      : [],
  });

  const agentsInventoryIndex = inventory.length;

  const attachmentsBlockText = artifactAttachmentsSection({ attachments }) ?? '';
  const questions = artifactQuestionContract({ kind: 'report' });

  const framingUsed =
    header.length +
    goalBlockText.length +
    attachmentsBlockText.length +
    request.text.length +
    questions.length;

  const artifactsText = artifactSection({
    artifacts: scopedArtifactList,
    truncations,
    sourceIds,
    inventory,
  });
  const diffText = diffSection({ diff, reason: diffUnavailableReason, inventory });
  const scoutsText = scoutBlock({ scouts, inventory }).join('\n\n');
  const checksText = scriptSection({ scriptRuns, inventory });
  const eventsText = eventSection({ events, truncations, inventory });

  const evidenceBlocks: ReadonlyArray<BudgetBlock> = [
    { id: 'scouts', text: scoutsText },
    { id: 'diff', text: diffText },
    { id: 'checks', text: checksText },
    { id: 'artifacts', text: artifactsText },
    { id: 'events', text: eventsText },
  ];
  const fittedEvidence = fitWithinBudget({
    blocks: evidenceBlocks,
    budget: REPORT_ALLOCATION_LIMITS.evidence,
  });
  fittedEvidence.clippedIds.forEach((id) => {
    truncations.push(`evidence pack: ${id} section shortened to fit the evidence budget`);
  });
  const evidenceById = new Map(fittedEvidence.blocks.map((block) => [block.id, block.text]));
  const evidenceUsed = fittedEvidence.blocks.reduce((sum, block) => sum + block.text.length, 0);

  const agentsPrepared = prepareAgents({
    agents: scopedAgentList,
    transcripts,
    truncations,
    sourceIds,
  });
  const candidates = agentsPrepared.kind === 'ready' ? agentsPrepared.candidates : [];

  const notesUsedSoFar = renderTruncationNotes(truncations).length;

  const allocation = allocateReportContext({
    totalCap: REPORT_CONTEXT_LIMITS.total,
    usage: {
      framingUsed,
      truncationNotesUsed: notesUsedSoFar,
      evidenceUsed,
    },
    agents: candidates,
  });
  const budgets = new Map(allocation.agents.map((agent) => [agent.id, agent.budget]));

  const renderedAgents = renderAgents({
    prepared: agentsPrepared,
    totalAgentCount: scopedAgentList.length,
    budgets,
    truncations,
  });
  const agentSectionText = renderedAgents.text;
  inventory.splice(agentsInventoryIndex, 0, renderedAgents.row);

  let pieces: BodyPieces = {
    header,
    goal: goalBlockText,
    attachments: attachmentsBlockText,
    agents: agentSectionText,
    artifacts: evidenceById.get('artifacts') ?? '',
    diff: evidenceById.get('diff') ?? '',
    scouts: evidenceById.get('scouts') ?? '',
    checks: evidenceById.get('checks') ?? '',
    events: evidenceById.get('events') ?? '',
  };

  const requestSection =
    request.text.length > 0 ? `# user request\n\n${redactSecrets({ text: request.text })}` : '';

  const render = ({
    pieces: currentPieces,
    notes,
  }: {
    readonly pieces: BodyPieces;
    readonly notes: string;
  }): string => {
    const body = renderBody(currentPieces);
    const tail = `${body}\n\n${notes}\n\n${questions}`;
    return requestSection.length > 0 ? `${requestSection}\n\n${tail}` : tail;
  };

  const notes0 = renderTruncationNotes(truncations);
  let finalText = render({ pieces, notes: notes0 });
  const shrinkTarget = REPORT_CONTEXT_LIMITS.total - FALLBACK_NOTE_MARGIN;
  const shrunkIds = new Set<BodyPieceId>();
  let shrinkIndex = 0;
  while (finalText.length > shrinkTarget && shrinkIndex < SHRINK_ORDER.length) {
    const id = SHRINK_ORDER[shrinkIndex];
    if (id === undefined) {
      break;
    }
    const current = pieces[id];
    if (current.length === 0) {
      shrinkIndex += 1;
      continue;
    }
    const overshoot = finalText.length - shrinkTarget;
    const target = Math.max(0, current.length - overshoot);
    const clipped = clipToBoundary({ text: current, limit: target });
    if (clipped.text.length === current.length) {
      shrinkIndex += 1;
      continue;
    }
    pieces = { ...pieces, [id]: clipped.text };
    shrunkIds.add(id);
    finalText = render({ pieces, notes: notes0 });
    shrinkIndex += 1;
  }
  const shrunkFurther = shrunkIds.size > 0;
  let notes = notes0;
  if (shrunkFurther) {
    truncations.push(
      `evidence pack: shortened ${[...shrunkIds].join(', ')} further to fit the total cap`,
    );
    notes = renderTruncationNotes(truncations);
    finalText = render({ pieces, notes });
  }

  inventory.push(excludedInventoryRow({ summary: REPORT_EXCLUDED_COPY }));
  inventory.push(
    sizeInventoryRow({
      size: finalText.length,
      cap: REPORT_CONTEXT_LIMITS.total,
      isCapped: shrunkFurther,
    }),
  );

  return {
    text: finalText,
    sourceIds,
    truncations,
    inventory,
  };
};
