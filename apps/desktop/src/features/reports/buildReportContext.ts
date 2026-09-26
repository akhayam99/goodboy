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
  reconcileSectionRow,
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
import { reportSourceName } from './reportSourceName';
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
  sessionTitle: 400,
  total: 48_000,
} as const;

export const REPORT_SESSION_TITLE_CLIP_NOTE = `session title cut at ${formatBriefCount({
  value: REPORT_CONTEXT_LIMITS.sessionTitle,
})} characters`;

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

type PreparedAgents = Readonly<{
  kept: ReadonlyArray<Agent>;
  messages: ReadonlyMap<AgentId, AssistantMessage | null>;
  candidates: ReadonlyArray<ReportAgentCandidate>;
  ids: ReadonlyArray<string>;
}>;

const prepareAgents = ({
  agents,
  transcripts,
  truncations,
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly transcripts: ReportContextParams['transcripts'];
  readonly truncations: Array<string>;
}): PreparedAgents => {
  if (agents.length === 0) {
    return { kept: [], messages: new Map(), candidates: [], ids: [] };
  }
  const kept = agents.slice(-REPORT_CONTEXT_LIMITS.agents);
  if (kept.length < agents.length) {
    truncations.push(
      `agents: kept the last ${kept.length} of ${agents.length}; earlier agents are missing`,
    );
  }
  const messages = new Map<AgentId, AssistantMessage | null>();
  kept.forEach((agent) => {
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
  return { kept, messages, candidates, ids: kept.map((agent) => agent.id) };
};

type RenderedAgents = Readonly<{
  text: string;
  row: ArtifactContextInventoryRow;
  notes: ReadonlyArray<string>;
}>;

const renderAgents = ({
  prepared,
  totalAgentCount,
  budgets,
}: {
  readonly prepared: PreparedAgents;
  readonly totalAgentCount: number;
  readonly budgets: ReadonlyMap<string, number>;
}): RenderedAgents => {
  const { kept, messages } = prepared;
  if (kept.length === 0) {
    return {
      text: '## agents\n\nno agents ran in this scope.',
      row: {
        id: 'agents',
        label: 'agents',
        summary: 'no agent has run in this scope',
        state: 'missing',
        detail: [],
      },
      notes: [],
    };
  }
  const notes: Array<string> = [];
  let silent = 0;
  let clippedCount = 0;
  let droppedCount = 0;
  const rows = kept.flatMap((agent) => {
    const name = redactSecrets({ text: reportSourceName({ source: { kind: 'agent', agent } }) });
    const message = messages.get(agent.id);
    if (message === null || message === undefined) {
      silent += 1;
      return [`### ${name} (agent ${agent.id}, ${agent.status})\n\nno assistant output recorded.`];
    }
    const budget = budgets.get(agent.id) ?? 0;
    if (budget <= 0) {
      droppedCount += 1;
      notes.push(`agent ${agent.id}: final message dropped to fit`);
      return [];
    }
    const clipped = clipToBoundary({ text: message.text, limit: budget });
    if (clipped.isClipped) {
      clippedCount += 1;
      notes.push(`agent ${agent.id}: final message truncated`);
    }
    return [`### ${name} (agent ${agent.id}, ${agent.status})\n\n${clipped.text}`];
  });
  const state =
    kept.length < totalAgentCount || clippedCount > 0 || droppedCount > 0 ? 'partial' : 'included';
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
        ...(droppedCount > 0 ? [`${droppedCount} did not fit and were dropped`] : []),
        ...(clippedCount > 0
          ? [`${clippedCount} final message(s) were shortened to fit the budget`]
          : []),
      ],
    },
    notes,
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

type EvidenceSectionId = 'artifacts' | 'diff' | 'scouts' | 'checks' | 'events';

type EvidenceSection = Readonly<{
  id: EvidenceSectionId;
  text: string;
  row: ArtifactContextInventoryRow | null;
  ids: ReadonlyArray<string>;
}>;

const artifactSection = ({
  artifacts,
  truncations,
}: {
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly truncations: Array<string>;
}): EvidenceSection => {
  if (artifacts.length === 0) {
    return {
      id: 'artifacts',
      text: '## artifacts\n\nno plans, reports or wireframes were captured in this scope.',
      row: {
        id: 'artifacts',
        label: 'artifacts',
        summary: 'no plan, report or wireframe in this scope',
        state: 'missing',
        detail: [],
      },
      ids: [],
    };
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
    const excerpt = artifactExcerpt({ artifact });
    detail.push(`${artifact.kind} ${artifact.id}: ${excerpt.summary}`);
    if (excerpt.isClipped) {
      hasClippedExcerpt = true;
      truncations.push(`artifact ${artifact.id}: excerpt truncated`);
    }
    const title = redactSecrets({ text: artifact.title });
    return `- ${artifact.kind} ${artifact.id} rev ${artifact.revision} (${artifact.status}) "${title}"\n  ${excerpt.text.replace(/\n/g, '\n  ')}`;
  });
  return {
    id: 'artifacts',
    text: `## artifacts\n\n${rows.join('\n')}`,
    row: {
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
    },
    ids: kept.map((artifact) => artifact.id),
  };
};

const diffSection = ({
  diff,
  reason,
}: {
  readonly diff: ReportDiffEvidence | null;
  readonly reason: ReportDiffUnavailableReason | null;
}): EvidenceSection => {
  if (diff === null) {
    return {
      id: 'diff',
      text: '## diff\n\nno mount diff was available at capture time.',
      row: {
        id: 'diff',
        label: 'local change',
        summary: reason === 'unreadable' ? 'the worktree could not be read' : 'no mounted project',
        state: 'missing',
        detail: [],
      },
      ids: [],
    };
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
  return {
    id: 'diff',
    text: [
      '## diff',
      '',
      `mount ${redactSecrets({ text: diff.mountName })}, base ${redactSecrets({ text: diff.baseBranch })}, head ${head}, +${diff.additions} -${diff.deletions}, ${diff.paths.length} files`,
      '',
      commits.length === 0 ? 'no commits recorded.' : `commits:\n${commits}`,
      '',
      paths.length === 0 ? 'no changed files recorded.' : `changed files:\n${paths}`,
    ].join('\n'),
    row: {
      id: 'diff',
      label: 'local change',
      summary: `${diff.mountName} against ${diff.baseBranch}: ${diff.commits.length} commits, ${diff.paths.length} files, +${diff.additions} -${diff.deletions}`,
      state: 'included',
      detail: ['file paths and commit subjects only, no file contents'],
    },
    ids: [],
  };
};

const scriptSection = ({
  scriptRuns,
}: {
  readonly scriptRuns: ReportContextParams['scriptRuns'];
}): EvidenceSection => {
  const rows = Object.entries(scriptRuns)
    .filter(([, record]) => record.status === 'ok' || record.status === 'error')
    .slice(0, REPORT_CONTEXT_LIMITS.scriptRuns)
    .map(([scriptId, record]) => {
      const exitCode = record.result?.exitCode ?? null;
      const exit = exitCode === null ? 'no exit code' : `exit ${exitCode}`;
      return `- ${redactSecrets({ text: record.name ?? scriptId })}: ${record.status}, ${exit}`;
    });
  if (rows.length === 0) {
    return {
      id: 'checks',
      text: '## checks\n\nno script or test run outcome was recorded in this session.',
      row: {
        id: 'checks',
        label: 'checks',
        summary: 'no script run recorded',
        state: 'missing',
        detail: [],
      },
      ids: [],
    };
  }
  return {
    id: 'checks',
    text: `## checks\n\n${rows.join('\n')}`,
    row: {
      id: 'checks',
      label: 'checks',
      summary: `${rows.length} script runs with an outcome, exit codes only`,
      state: 'included',
      detail: ['scripts you ran from this session, not CI'],
    },
    ids: [],
  };
};

const eventSection = ({
  events,
  truncations,
}: {
  readonly events: ReadonlyArray<SessionEvent>;
  readonly truncations: Array<string>;
}): EvidenceSection => {
  if (events.length === 0) {
    return {
      id: 'events',
      text: '## session events\n\nno session events were recorded.',
      row: {
        id: 'events',
        label: 'session events',
        summary: 'no session event recorded',
        state: 'missing',
        detail: [],
      },
      ids: [],
    };
  }
  const kept = events.slice(-REPORT_CONTEXT_LIMITS.events);
  if (kept.length < events.length) {
    truncations.push(
      `session events: kept the last ${kept.length} of ${events.length}; earlier events are missing`,
    );
  }
  const rows = kept.map((event) => `- ${event.createdAt} ${event.kind}`);
  return {
    id: 'events',
    text: `## session events\n\n${rows.join('\n')}`,
    row: {
      id: 'events',
      label: 'session events',
      summary: `last ${kept.length} of ${events.length} session events, kind and time only`,
      state: keptRowState({ kept: kept.length, total: events.length }),
      detail: [],
    },
    ids: [],
  };
};

const scoutSection = ({
  scouts,
}: {
  readonly scouts: ReportScoutEvidence | null;
}): EvidenceSection => {
  if (scouts === null) {
    return { id: 'scouts', text: '', row: null, ids: [] };
  }
  if (scouts.section === null) {
    return {
      id: 'scouts',
      text: '',
      row: {
        id: 'scouts',
        label: 'scouts',
        summary: scouts.note ?? REPORT_NO_SCOUT_COPY,
        state: 'missing',
        detail: ['the report is written from the evidence in this pack alone'],
      },
      ids: [],
    };
  }
  return {
    id: 'scouts',
    text: scouts.section,
    row: {
      id: 'scouts',
      label: 'scouts',
      summary: `${scouts.names.length} scouts read the diff context in parallel, one turn each: ${scouts.names.join(', ')}`,
      state: 'included',
      detail: [],
    },
    ids: [],
  };
};

const reconcileSection = ({
  section,
  survived,
}: {
  readonly section: EvidenceSection;
  readonly survived: string;
}): ArtifactContextInventoryRow | null =>
  reconcileSectionRow({
    row: section.row,
    fullLength: section.text.length,
    survivedLength: survived.length,
  });

type BoundAttachments = Readonly<{
  text: string;
  kept: ReadonlyArray<ArtifactAttachment>;
}>;

const boundAttachments = ({
  attachments,
  budget,
}: {
  readonly attachments: ReadonlyArray<ArtifactAttachment>;
  readonly budget: number;
}): BoundAttachments => {
  const section = artifactAttachmentsSection({ attachments });
  if (section === null) {
    return { text: '', kept: attachments };
  }
  if (section.length <= budget) {
    return { text: section, kept: attachments };
  }
  const lines = attachments.map((attachment) => `- ${attachment.relPath}`);
  const overhead = section.length - lines.join('\n').length;
  let used = overhead;
  let count = 0;
  for (const [index, line] of lines.entries()) {
    const cost = index === 0 ? line.length : line.length + 1;
    if (used + cost > budget) {
      break;
    }
    used += cost;
    count = index + 1;
  }
  const kept = attachments.slice(0, count);
  return { text: artifactAttachmentsSection({ attachments: kept }) ?? '', kept };
};

const attachmentsRow = ({
  attachments,
  kept,
}: {
  readonly attachments: ReadonlyArray<ArtifactAttachment>;
  readonly kept: ReadonlyArray<ArtifactAttachment>;
}): ArtifactContextInventoryRow => {
  const row = attachmentsInventoryRow({ attachments });
  const dropped = attachments.length - kept.length;
  if (dropped === 0) {
    return row;
  }
  return {
    ...row,
    state: kept.length === 0 ? 'missing' : 'partial',
    detail: [
      ...kept.map((attachment) => attachment.fileName),
      `${dropped} of ${attachments.length} paths did not fit the framing budget`,
    ],
  };
};

const renderTruncationNotes = (notes: ReadonlyArray<string>): string =>
  notes.length === 0
    ? '## truncation\n\nnothing was truncated.'
    : `## truncation\n\n${notes.map((note) => `- ${note}`).join('\n')}`;

type BodyPieceId = 'header' | 'goal' | 'attachments' | 'agents' | EvidenceSectionId;

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

const EVIDENCE_SHRINK_ORDER: ReadonlyArray<EvidenceSectionId> = [
  'events',
  'checks',
  'artifacts',
  'diff',
  'scouts',
];

const INVENTORY_EVIDENCE_ORDER: ReadonlyArray<EvidenceSectionId> = [
  'artifacts',
  'diff',
  'scouts',
  'checks',
  'events',
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
  const baseIds: Array<string> = [session.id];
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
  const sessionTitle = clipToBoundary({
    text: redactSecrets({ text: session.goal }),
    limit: REPORT_CONTEXT_LIMITS.sessionTitle,
  });
  if (sessionTitle.isClipped) {
    truncations.push(REPORT_SESSION_TITLE_CLIP_NOTE);
  }
  const header = [
    `# evidence pack: ${REPORT_TYPE_LABEL[reportType]}`,
    '',
    REPORT_DEFAULT_REQUEST({ reportType }),
    `scope: ${scope}. captured at ${capturedAt}.`,
    `session ${session.id}: ${sessionTitle.text}`,
    '',
    'this pack is the only evidence you have. it carries final agent messages, not tool calls or tool output. never invent a fact that is not here; say plainly what is missing.',
  ].join('\n');

  const goalBlockText = goal.isDetailed ? `## goal\n\n${goal.packText}` : '';
  const questions = artifactQuestionContract({ kind: 'report' });

  if (workflowRunId !== null) {
    baseIds.push(workflowRunId);
  }

  const bounded = boundAttachments({
    attachments,
    budget: Math.max(
      0,
      REPORT_ALLOCATION_LIMITS.framing -
        header.length -
        goalBlockText.length -
        request.text.length -
        questions.length,
    ),
  });
  const attachmentsBlockText = bounded.text;
  const droppedAttachments = attachments.length - bounded.kept.length;
  if (droppedAttachments > 0) {
    truncations.push(
      `attachments: ${droppedAttachments} of ${attachments.length} paths did not fit the framing budget`,
    );
  }

  const framingRows: ReadonlyArray<ArtifactContextInventoryRow> = [
    briefInventoryRow({ brief: request.text }),
    attachmentsRow({ attachments, kept: bounded.kept }),
    {
      id: 'goal',
      label: 'goal',
      summary: 'the session goal and the report type',
      state: goal.isClipped ? 'partial' : 'included',
      detail: goal.isDetailed
        ? [`the goal you wrote, ${formatBriefCount({ value: goal.packText.length })} characters`]
        : [],
    },
  ];

  const framingUsed =
    header.length +
    goalBlockText.length +
    attachmentsBlockText.length +
    request.text.length +
    questions.length;

  const sections: ReadonlyArray<EvidenceSection> = [
    scoutSection({ scouts }),
    diffSection({ diff, reason: diffUnavailableReason }),
    scriptSection({ scriptRuns }),
    artifactSection({ artifacts: scopedArtifactList, truncations }),
    eventSection({ events, truncations }),
  ];
  const sectionById = new Map(sections.map((section) => [section.id, section]));

  const evidenceBlocks: ReadonlyArray<BudgetBlock> = sections.map((section) => ({
    id: section.id,
    text: section.text,
  }));
  const fittedEvidence = fitWithinBudget({
    blocks: evidenceBlocks,
    budget: REPORT_ALLOCATION_LIMITS.evidence,
  });
  const evidenceById = new Map(fittedEvidence.blocks.map((block) => [block.id, block.text]));
  fittedEvidence.clippedIds.forEach((id) => {
    const kept = evidenceById.get(id) ?? '';
    truncations.push(
      kept.length === 0
        ? `evidence pack: ${id} section removed to fit the evidence budget`
        : `evidence pack: ${id} section shortened to fit the evidence budget`,
    );
  });
  const evidenceUsed = fittedEvidence.blocks.reduce((sum, block) => sum + block.text.length, 0);

  const agentsPrepared = prepareAgents({ agents: scopedAgentList, transcripts, truncations });

  const allocation = allocateReportContext({
    totalCap: REPORT_CONTEXT_LIMITS.total,
    usage: {
      framingUsed,
      truncationNotesUsed: renderTruncationNotes(truncations).length,
      evidenceUsed,
    },
    agents: agentsPrepared.candidates,
  });
  const messageLengths = new Map(
    agentsPrepared.candidates.map((candidate) => [candidate.id, candidate.textLength]),
  );

  const requestSection =
    request.text.length > 0 ? `# user request\n\n${redactSecrets({ text: request.text })}` : '';

  const assemble = ({ body, notes }: { readonly body: string; readonly notes: string }): string =>
    [requestSection, body, notes, questions].filter((piece) => piece.length > 0).join('\n\n');

  let pieces: BodyPieces = {
    header,
    goal: goalBlockText,
    attachments: attachmentsBlockText,
    agents: '',
    artifacts: evidenceById.get('artifacts') ?? '',
    diff: evidenceById.get('diff') ?? '',
    scouts: evidenceById.get('scouts') ?? '',
    checks: evidenceById.get('checks') ?? '',
    events: evidenceById.get('events') ?? '',
  };
  let agentBudgets: ReadonlyMap<string, number> = new Map(
    allocation.agents.map((allocated) => [allocated.id, allocated.budget]),
  );
  const shrunkIds = new Set<EvidenceSectionId>();

  const compose = (): Readonly<{ rendered: RenderedAgents; body: string; notes: string }> => {
    const rendered = renderAgents({
      prepared: agentsPrepared,
      totalAgentCount: scopedAgentList.length,
      budgets: agentBudgets,
    });
    const notes = renderTruncationNotes([
      ...truncations,
      ...rendered.notes,
      ...(shrunkIds.size === 0
        ? []
        : [`evidence pack: shortened ${[...shrunkIds].join(', ')} further to fit the total cap`]),
    ]);
    return {
      rendered,
      body: renderBody({ ...pieces, agents: rendered.text }),
      notes,
    };
  };

  let current = compose();
  let isCapped = false;

  EVIDENCE_SHRINK_ORDER.forEach((id) => {
    const composed = assemble({ body: current.body, notes: current.notes });
    if (composed.length <= REPORT_CONTEXT_LIMITS.total) {
      return;
    }
    const piece = pieces[id];
    if (piece.length === 0) {
      return;
    }
    const clipped = clipToBoundary({
      text: piece,
      limit: Math.max(0, piece.length - (composed.length - REPORT_CONTEXT_LIMITS.total)),
    });
    if (clipped.text.length === piece.length) {
      return;
    }
    pieces = { ...pieces, [id]: clipped.text };
    shrunkIds.add(id);
    isCapped = true;
    current = compose();
  });

  [...allocation.agents]
    .map((allocated) => allocated.id)
    .reverse()
    .forEach((id) => {
      const composed = assemble({ body: current.body, notes: current.notes });
      if (composed.length <= REPORT_CONTEXT_LIMITS.total) {
        return;
      }
      const shown = Math.min(agentBudgets.get(id) ?? 0, messageLengths.get(id) ?? 0);
      if (shown <= 0) {
        return;
      }
      const next = new Map(agentBudgets);
      next.set(id, Math.max(0, shown - (composed.length - REPORT_CONTEXT_LIMITS.total)));
      agentBudgets = next;
      isCapped = true;
      current = compose();
    });

  const composed = assemble({ body: current.body, notes: current.notes });
  const guarded = ((): string => {
    if (composed.length <= REPORT_CONTEXT_LIMITS.total) {
      return composed;
    }
    isCapped = true;
    const bodyLimit = Math.max(
      0,
      current.body.length - (composed.length - REPORT_CONTEXT_LIMITS.total),
    );
    const body = clipToBoundary({ text: current.body, limit: bodyLimit }).text;
    const withBody = assemble({ body, notes: current.notes });
    if (withBody.length <= REPORT_CONTEXT_LIMITS.total) {
      return withBody;
    }
    const notesLimit = Math.max(
      0,
      current.notes.length - (withBody.length - REPORT_CONTEXT_LIMITS.total),
    );
    return assemble({
      body,
      notes: clipToBoundary({ text: current.notes, limit: notesLimit }).text,
    });
  })();

  const evidenceRows = INVENTORY_EVIDENCE_ORDER.flatMap((id) => {
    const section = sectionById.get(id);
    if (section === undefined) {
      return [];
    }
    const row = reconcileSection({ section, survived: pieces[id] });
    return row === null ? [] : [row];
  });

  const artifactsSection = sectionById.get('artifacts');
  const keptArtifactIds = (artifactsSection?.ids ?? []).filter((id) => guarded.includes(id));

  return {
    text: guarded,
    sourceIds: [...baseIds, ...keptArtifactIds, ...agentsPrepared.ids],
    truncations: [
      ...truncations,
      ...current.rendered.notes,
      ...(shrunkIds.size === 0
        ? []
        : [`evidence pack: shortened ${[...shrunkIds].join(', ')} further to fit the total cap`]),
    ],
    inventory: [
      ...framingRows,
      current.rendered.row,
      ...evidenceRows,
      excludedInventoryRow({ summary: REPORT_EXCLUDED_COPY }),
      sizeInventoryRow({
        size: guarded.length,
        cap: REPORT_CONTEXT_LIMITS.total,
        isCapped,
      }),
    ],
  };
};
