import { WIREFRAME_SCHEMA_BRIEF } from '@goodboy/core';
import type { Agent, IsoDateTime, Session, SessionArtifact, TurnEvent } from '@goodboy/types';
import { redactSecrets } from '../../shared/utils/redactSecrets';
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
import {
  allocateReportContext,
  clipToBoundary,
  fitWithinBudget,
  reconcileSectionRow,
  type BudgetBlock,
  type ReportAgentCandidate,
} from '../reports/allocateReportContext';
import { hasDesignEvidence, type DesignEvidence, type DesignProfile } from './collectDesignProfile';
import { describeDesignProfile } from './describeDesignProfile';
import { WIREFRAME_FIDELITY_LABEL, type WireframeFidelity } from './wireframeFidelity';
import { wireframeScoutInventoryRow, type WireframeScoutPlan } from './wireframeScoutPlan';
import {
  WIREFRAME_TARGET_BRIEF,
  WIREFRAME_TARGET_LABEL,
  type WireframeTarget,
} from './wireframeTarget';

export const WIREFRAME_CONTEXT_LIMITS = {
  agents: 8,
  artifacts: 6,
  artifactExcerpt: 700,
  framing: 14_000,
  truncationNotes: 2_000,
  evidence: 24_000,
  olderAgentReserve: 600,
  total: 49_000,
} as const;

export const WIREFRAME_DEFAULT_REQUEST =
  'produce one wireframe document for this product from the evidence below. cover the screens the goal actually needs, and wire the transitions a user would take between them.';

export const WIREFRAME_EXCLUDED_COPY =
  'never sent: reports, wireframes, the local change, checks, session events, tool calls, tool output';

export type WireframeContextParams = Readonly<{
  fidelity: WireframeFidelity;
  target: WireframeTarget;
  brief?: string | null;
  attachments: ReadonlyArray<ArtifactAttachment>;
  session: Session;
  goal: SessionGoalText;
  agents: ReadonlyArray<Agent>;
  transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  artifacts: ReadonlyArray<SessionArtifact>;
  designEvidence: DesignEvidence;
  scoutPlan?: WireframeScoutPlan | null;
  scoutSection?: string | null;
  capturedAt: IsoDateTime;
}>;

export type WireframeContext = Readonly<{
  text: string;
  sourceIds: ReadonlyArray<string>;
  truncations: ReadonlyArray<string>;
  inventory: ReadonlyArray<ArtifactContextInventoryRow>;
}>;

const isAssistantTextEvent = (
  event: TurnEvent,
): event is Extract<TurnEvent, { kind: 'assistant_text' }> => event.kind === 'assistant_text';

type AgentMessage = Readonly<{ text: string; at: IsoDateTime }>;

const lastAssistantMessage = ({
  events,
}: {
  readonly events: ReadonlyArray<TurnEvent>;
}): AgentMessage | null => {
  const assistantEvents = events.filter(isAssistantTextEvent);
  const lastEvent = assistantEvents[assistantEvents.length - 1];
  if (lastEvent === undefined) {
    return null;
  }
  const joined = assistantEvents
    .filter((event) => event.runId === lastEvent.runId)
    .map((event) => event.delta)
    .join('');
  const trimmed = joined.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return { text: trimmed, at: lastEvent.at };
};

type PreparedAgents = Readonly<{
  kept: ReadonlyArray<Agent>;
  messages: ReadonlyMap<string, AgentMessage | null>;
  candidates: ReadonlyArray<ReportAgentCandidate>;
  total: number;
}>;

const prepareAgents = ({
  agents,
  transcripts,
  truncations,
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly transcripts: WireframeContextParams['transcripts'];
  readonly truncations: Array<string>;
}): PreparedAgents => {
  const ordered = [...agents].sort((left, right) => left.ordinal - right.ordinal);
  if (ordered.length === 0) {
    return { kept: [], messages: new Map(), candidates: [], total: 0 };
  }
  const kept = ordered.slice(-WIREFRAME_CONTEXT_LIMITS.agents);
  if (kept.length < ordered.length) {
    truncations.push(
      `agents: kept the last ${kept.length} of ${ordered.length}; earlier agents are missing`,
    );
  }
  const messages = new Map<string, AgentMessage | null>();
  kept.forEach((agent) => {
    const message = lastAssistantMessage({ events: transcripts[agent.id] ?? [] });
    messages.set(
      agent.id,
      message === null ? null : { text: redactSecrets({ text: message.text }), at: message.at },
    );
  });
  const candidates = kept.flatMap((agent) => {
    const message = messages.get(agent.id);
    if (message === null || message === undefined) {
      return [];
    }
    return [
      {
        id: agent.id,
        ordinal: agent.ordinal,
        lastAssistantAt: message.at,
        textLength: message.text.length,
      },
    ];
  });
  return { kept, messages, candidates, total: ordered.length };
};

type RenderedAgents = Readonly<{
  text: string;
  row: ArtifactContextInventoryRow;
  notes: ReadonlyArray<string>;
  ids: ReadonlyArray<string>;
}>;

const renderAgents = ({
  prepared,
  budgets,
}: {
  readonly prepared: PreparedAgents;
  readonly budgets: ReadonlyMap<string, number>;
}): RenderedAgents => {
  const { kept, messages, total } = prepared;
  if (kept.length === 0) {
    return {
      text: '## product evidence\n\nno agent has run in this session yet.',
      row: {
        id: 'agents',
        label: 'agents',
        summary: 'no agent has run in this scope',
        state: 'missing',
        detail: [],
      },
      notes: [],
      ids: [],
    };
  }
  const notes: Array<string> = [];
  const ids: Array<string> = [];
  let silent = 0;
  let clippedCount = 0;
  let droppedCount = 0;
  const rows = kept.flatMap((agent) => {
    const name = redactSecrets({ text: agent.name });
    const message = messages.get(agent.id);
    if (message === null || message === undefined) {
      silent += 1;
      ids.push(agent.id);
      return [`### ${name} (${agent.id})\n\nno final message was recorded.`];
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
    ids.push(agent.id);
    return [`### ${name} (${agent.id})\n\n${clipped.text}`];
  });
  const isPartial = kept.length < total || clippedCount > 0 || droppedCount > 0;
  return {
    text:
      rows.length === 0
        ? '## product evidence\n\nno final agent message fit the pack budget.'
        : `## product evidence\n\n${rows.join('\n\n')}`,
    row: {
      id: 'agents',
      label: 'agents',
      summary: `${kept.length} of ${total} agents, most recent final message given priority within a shared budget`,
      state: isPartial ? 'partial' : 'included',
      detail: [
        ...(kept.length < total
          ? [`only the last ${WIREFRAME_CONTEXT_LIMITS.agents} fit, earlier agents are missing`]
          : []),
        ...(silent > 0 ? [`${silent} had no final message recorded`] : []),
        ...(droppedCount > 0 ? [`${droppedCount} did not fit and were dropped`] : []),
        ...(clippedCount > 0
          ? [`${clippedCount} final message(s) were shortened to fit the budget`]
          : []),
      ],
    },
    notes,
    ids,
  };
};

type WireframeEvidenceId = 'plans' | 'scouts' | 'theme';

type WireframeEvidenceSection = Readonly<{
  id: WireframeEvidenceId;
  text: string;
  row: ArtifactContextInventoryRow | null;
  ids: ReadonlyArray<string>;
}>;

const planSection = ({
  artifacts,
  truncations,
}: {
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly truncations: Array<string>;
}): WireframeEvidenceSection => {
  const plans = artifacts.filter(
    (artifact) => artifact.kind === 'plan' && artifact.status !== 'discarded',
  );
  if (plans.length === 0) {
    return {
      id: 'plans',
      text: '## plans\n\nthis session has no plan artifact.',
      row: {
        id: 'plans',
        label: 'plans',
        summary: 'this session has no plan',
        state: 'missing',
        detail: [],
      },
      ids: [],
    };
  }
  const kept = plans.slice(-WIREFRAME_CONTEXT_LIMITS.artifacts);
  if (kept.length < plans.length) {
    truncations.push(`plans: kept the last ${kept.length} of ${plans.length}`);
  }
  const rows = kept.map((plan) => {
    const clipped = clipToBoundary({
      text: redactSecrets({ text: plan.sourceText }),
      limit: WIREFRAME_CONTEXT_LIMITS.artifactExcerpt,
    });
    if (clipped.isClipped) {
      truncations.push(`plan ${plan.id}: excerpt clipped`);
    }
    const title = redactSecrets({ text: plan.title });
    return `### ${title} (${plan.id})\n\n${clipped.text}`;
  });
  return {
    id: 'plans',
    text: `## plans\n\n${rows.join('\n\n')}`,
    row: {
      id: 'plans',
      label: 'plans',
      summary: `${kept.length} of ${plans.length} session plans, first ${WIREFRAME_CONTEXT_LIMITS.artifactExcerpt} characters of each`,
      state: keptRowState({ kept: kept.length, total: plans.length }),
      detail: ['session plans, not scoped to a run'],
    },
    ids: kept.map((plan) => plan.id),
  };
};

const themeProfileRow = ({
  profile,
}: {
  readonly profile: DesignProfile;
}): ArtifactContextInventoryRow => {
  const pin = profile.commitSha === null ? ', head not pinned' : ` at ${profile.commitSha}`;
  return {
    id: 'theme',
    label: 'theme',
    summary: `design profile from ${profile.themeName}${pin}: ${profile.tailwind === null ? 'no tailwind config' : 'tailwind config'}, ${profile.tokens.length} tokens, ${profile.variants.length} component variant groups, ${profile.layoutExamples.length} layout examples`,
    state: profile.notes.length === 0 ? 'included' : 'partial',
    detail: profile.notes,
  };
};

const genericThemeSection = ({ reason }: { readonly reason: string }): string =>
  [
    '## theme',
    `high fidelity was requested but ${reason}. set theme.name to "generic", never invent branding, and say in a node note that the theme is generic.`,
  ].join('\n\n');

const themeSection = ({
  fidelity,
  designEvidence,
}: {
  readonly fidelity: WireframeFidelity;
  readonly designEvidence: DesignEvidence;
}): WireframeEvidenceSection => {
  if (fidelity === 'low') {
    return {
      id: 'theme',
      text: [
        '## theme',
        'this is a low fidelity wireframe. set theme.name to "generic", leave theme.colors out, and lean on layout, hierarchy and node notes rather than styling.',
      ].join('\n\n'),
      row: {
        id: 'theme',
        label: 'theme',
        summary: 'plain wireframe, no design files read',
        state: 'missing',
        detail: [],
      },
      ids: [],
    };
  }
  if (designEvidence.source === 'none') {
    return {
      id: 'theme',
      text: genericThemeSection({ reason: 'no repository is mounted, so nothing could be read' }),
      row: {
        id: 'theme',
        label: 'theme',
        summary: 'no repository is mounted, so no design file was read',
        state: 'missing',
        detail: [],
      },
      ids: [],
    };
  }
  const profile = designEvidence.profile;
  if (!hasDesignEvidence({ profile })) {
    return {
      id: 'theme',
      text: genericThemeSection({
        reason: 'the mounted repository was walked and it holds no design file the app could read',
      }),
      row: {
        id: 'theme',
        label: 'theme',
        summary: 'the mounted repository was walked and no design file was found',
        state: 'missing',
        detail: profile.notes,
      },
      ids: [],
    };
  }
  return {
    id: 'theme',
    text: [
      '## design profile',
      'this profile was read by the app from the mounted repository. use it for theme.name, theme.colors and the component vocabulary, and list the file paths you leaned on in theme.sources. never import or execute anything from the repository.',
      describeDesignProfile({ profile }),
    ].join('\n\n'),
    row: themeProfileRow({ profile }),
    ids: [],
  };
};

const scoutEvidence = ({
  scoutPlan,
  scoutSection,
}: {
  readonly scoutPlan: WireframeScoutPlan | null;
  readonly scoutSection: string | null;
}): WireframeEvidenceSection => ({
  id: 'scouts',
  text: scoutSection ?? '',
  row: scoutPlan === null ? null : wireframeScoutInventoryRow({ plan: scoutPlan }),
  ids: [],
});

type BodyPieceId = 'header' | 'goal' | 'attachments' | 'agents' | WireframeEvidenceId;

type BodyPieces = Readonly<Record<BodyPieceId, string>>;

const BODY_ORDER: ReadonlyArray<BodyPieceId> = [
  'header',
  'goal',
  'attachments',
  'agents',
  'plans',
  'scouts',
  'theme',
];

const EVIDENCE_ORDER: ReadonlyArray<WireframeEvidenceId> = ['plans', 'scouts', 'theme'];

const renderBody = (pieces: BodyPieces): string =>
  BODY_ORDER.map((id) => pieces[id])
    .filter((piece) => piece.length > 0)
    .join('\n\n');

const renderTruncationNotes = (notes: ReadonlyArray<string>): string =>
  notes.length === 0
    ? '## truncation\n\nnothing was truncated.'
    : `## truncation\n\n${notes.map((note) => `- ${note}`).join('\n')}`;

export const buildWireframeContext = ({
  fidelity,
  target,
  brief = null,
  attachments,
  session,
  goal,
  agents,
  transcripts,
  artifacts,
  designEvidence,
  scoutPlan = null,
  scoutSection = null,
  capturedAt,
}: WireframeContextParams): WireframeContext => {
  const truncations: Array<string> = [];
  const request = clipBrief({ text: brief ?? '' });
  if (request.isClipped) {
    truncations.push(ARTIFACT_BRIEF_CLIP_NOTE);
  }
  if (goal.isClipped) {
    truncations.push(SESSION_GOAL_CLIP_NOTE);
  }
  const header = [
    `# ${WIREFRAME_FIDELITY_LABEL[fidelity].toLowerCase()} wireframe request`,
    `session ${goal.isDetailed ? 'title' : 'goal'}: ${redactSecrets({ text: session.goal })}`,
    `captured at: ${capturedAt}`,
    `target: ${WIREFRAME_TARGET_LABEL[target]}. ${WIREFRAME_TARGET_BRIEF[target]}`,
    WIREFRAME_DEFAULT_REQUEST,
    'this pack is the only evidence you have. it carries final agent messages, not tool calls or tool output. never invent a product fact that is not here; put what is missing in a node note.',
  ].join('\n');

  const goalBlockText = goal.isDetailed ? `## goal\n\n${goal.packText}` : '';
  const attachmentsBlockText = artifactAttachmentsSection({ attachments }) ?? '';
  const requestSection =
    request.text.length > 0 ? `# user request\n\n${redactSecrets({ text: request.text })}` : '';
  const questions = artifactQuestionContract({ kind: 'wireframe' });
  const contract = `## document contract\n\n${WIREFRAME_SCHEMA_BRIEF}`;

  const framingRows: ReadonlyArray<ArtifactContextInventoryRow> = [
    briefInventoryRow({ brief: request.text }),
    attachmentsInventoryRow({ attachments }),
    {
      id: 'goal',
      label: 'goal',
      summary: 'the session goal and the fidelity',
      state: goal.isClipped ? 'partial' : 'included',
      detail: goal.isDetailed
        ? [`the goal you wrote, ${formatBriefCount({ value: goal.packText.length })} characters`]
        : [],
    },
    {
      id: 'target',
      label: 'target',
      summary: `drawn for ${WIREFRAME_TARGET_LABEL[target]}`,
      state: 'included',
      detail: [WIREFRAME_TARGET_BRIEF[target]],
    },
  ];

  const framingUsed =
    header.length +
    goalBlockText.length +
    attachmentsBlockText.length +
    requestSection.length +
    questions.length +
    contract.length;

  const sections: ReadonlyArray<WireframeEvidenceSection> = [
    themeSection({ fidelity, designEvidence }),
    scoutEvidence({ scoutPlan, scoutSection }),
    planSection({ artifacts, truncations }),
  ];
  const sectionById = new Map(sections.map((section) => [section.id, section]));

  const evidenceBlocks: ReadonlyArray<BudgetBlock> = sections.map((section) => ({
    id: section.id,
    text: section.text,
  }));
  const fittedEvidence = fitWithinBudget({
    blocks: evidenceBlocks,
    budget: WIREFRAME_CONTEXT_LIMITS.evidence,
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

  const prepared = prepareAgents({ agents, transcripts, truncations });
  const allocation = allocateReportContext({
    totalCap: WIREFRAME_CONTEXT_LIMITS.total,
    usage: {
      framingUsed,
      truncationNotesUsed: renderTruncationNotes(truncations).length,
      evidenceUsed,
    },
    agents: prepared.candidates,
    limits: WIREFRAME_CONTEXT_LIMITS,
  });
  const messageLengths = new Map(
    prepared.candidates.map((candidate) => [candidate.id, candidate.textLength]),
  );

  let pieces: BodyPieces = {
    header,
    goal: goalBlockText,
    attachments: attachmentsBlockText,
    agents: '',
    plans: evidenceById.get('plans') ?? '',
    scouts: evidenceById.get('scouts') ?? '',
    theme: evidenceById.get('theme') ?? '',
  };
  let agentBudgets: ReadonlyMap<string, number> = new Map(
    allocation.agents.map((allocated) => [allocated.id, allocated.budget]),
  );
  const shrunkIds = new Set<WireframeEvidenceId>();

  const assemble = ({ body, notes }: { readonly body: string; readonly notes: string }): string =>
    [requestSection, body, notes, questions, contract]
      .filter((piece) => piece.length > 0)
      .join('\n\n');

  const compose = (): Readonly<{ rendered: RenderedAgents; body: string; notes: string }> => {
    const rendered = renderAgents({ prepared, budgets: agentBudgets });
    const notes = renderTruncationNotes([
      ...truncations,
      ...rendered.notes,
      ...(shrunkIds.size === 0
        ? []
        : [`evidence pack: shortened ${[...shrunkIds].join(', ')} further to fit the total cap`]),
    ]);
    return { rendered, body: renderBody({ ...pieces, agents: rendered.text }), notes };
  };

  let current = compose();
  let isCapped = false;

  [...allocation.agents]
    .map((allocated) => allocated.id)
    .reverse()
    .forEach((id) => {
      const composed = assemble({ body: current.body, notes: current.notes });
      if (composed.length <= WIREFRAME_CONTEXT_LIMITS.total) {
        return;
      }
      const shown = Math.min(agentBudgets.get(id) ?? 0, messageLengths.get(id) ?? 0);
      if (shown <= 0) {
        return;
      }
      const next = new Map(agentBudgets);
      next.set(id, Math.max(0, shown - (composed.length - WIREFRAME_CONTEXT_LIMITS.total)));
      agentBudgets = next;
      isCapped = true;
      current = compose();
    });

  EVIDENCE_ORDER.forEach((id) => {
    const composed = assemble({ body: current.body, notes: current.notes });
    if (composed.length <= WIREFRAME_CONTEXT_LIMITS.total) {
      return;
    }
    const piece = pieces[id];
    if (piece.length === 0) {
      return;
    }
    const clipped = clipToBoundary({
      text: piece,
      limit: Math.max(0, piece.length - (composed.length - WIREFRAME_CONTEXT_LIMITS.total)),
    });
    if (clipped.text.length === piece.length) {
      return;
    }
    pieces = { ...pieces, [id]: clipped.text };
    shrunkIds.add(id);
    isCapped = true;
    current = compose();
  });

  const composed = assemble({ body: current.body, notes: current.notes });
  const guarded = ((): string => {
    if (composed.length <= WIREFRAME_CONTEXT_LIMITS.total) {
      return composed;
    }
    isCapped = true;
    const bodyLimit = Math.max(
      0,
      current.body.length - (composed.length - WIREFRAME_CONTEXT_LIMITS.total),
    );
    const body = clipToBoundary({ text: current.body, limit: bodyLimit }).text;
    const withBody = assemble({ body, notes: current.notes });
    if (withBody.length <= WIREFRAME_CONTEXT_LIMITS.total) {
      return withBody;
    }
    const notesLimit = Math.max(
      0,
      current.notes.length - (withBody.length - WIREFRAME_CONTEXT_LIMITS.total),
    );
    return assemble({
      body,
      notes: clipToBoundary({ text: current.notes, limit: notesLimit }).text,
    });
  })();

  const evidenceRows = EVIDENCE_ORDER.flatMap((id) => {
    const section = sectionById.get(id);
    if (section === undefined) {
      return [];
    }
    const row = reconcileSectionRow({
      row: section.row,
      fullLength: section.text.length,
      survivedLength: pieces[id].length,
    });
    return row === null ? [] : [row];
  });

  const keptPlanIds = (sectionById.get('plans')?.ids ?? []).filter((id) => guarded.includes(id));

  return {
    text: guarded,
    sourceIds: [session.id, ...current.rendered.ids, ...keptPlanIds],
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
      excludedInventoryRow({ summary: WIREFRAME_EXCLUDED_COPY }),
      sizeInventoryRow({
        size: guarded.length,
        cap: WIREFRAME_CONTEXT_LIMITS.total,
        isCapped,
      }),
    ],
  };
};
