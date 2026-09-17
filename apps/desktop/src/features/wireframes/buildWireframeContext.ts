import { WIREFRAME_SCHEMA_BRIEF } from '@goodboy/core';
import type { Agent, IsoDateTime, Session, SessionArtifact, TurnEvent } from '@goodboy/types';
import { redactSecrets } from '../../shared/utils/redactSecrets';
import { ARTIFACT_BRIEF_CLIP_NOTE, clipBrief, formatBriefCount } from '../artifacts/artifactBrief';
import {
  artifactAttachmentsSection,
  attachmentsInventoryRow,
  type ArtifactAttachment,
} from '../artifacts/artifactAttachments';
import {
  briefInventoryRow,
  excludedInventoryRow,
  keptRowState,
  sizeInventoryRow,
  type ArtifactContextInventoryRow,
} from '../artifacts/artifactContextInventory';
import { SESSION_GOAL_CLIP_NOTE, type SessionGoalText } from '../artifacts/sessionGoalText';
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
  agentText: 900,
  artifacts: 6,
  artifactExcerpt: 700,
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

const clip = ({
  text,
  limit,
}: {
  readonly text: string;
  readonly limit: number;
}): { readonly text: string; readonly isClipped: boolean } => {
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

const agentSection = ({
  agents,
  transcripts,
  truncations,
  sourceIds,
  inventory,
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly transcripts: WireframeContextParams['transcripts'];
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
    return '## product evidence\n\nno agent has run in this session yet.';
  }
  const ordered = [...agents].sort((left, right) => left.ordinal - right.ordinal);
  const kept = ordered.slice(-WIREFRAME_CONTEXT_LIMITS.agents);
  if (kept.length < ordered.length) {
    truncations.push(
      `agents: kept the last ${kept.length} of ${ordered.length}; earlier agents are missing`,
    );
  }
  const rows = kept.map((agent) => {
    sourceIds.push(agent.id);
    const name = redactSecrets({ text: agent.name });
    const text = lastAssistantText({ events: transcripts[agent.id] ?? [] });
    if (text === null) {
      return `### ${name} (${agent.id})\n\nno final message was recorded.`;
    }
    const clipped = clip({ text, limit: WIREFRAME_CONTEXT_LIMITS.agentText });
    if (clipped.isClipped) {
      truncations.push(`agent ${agent.id}: final message clipped`);
    }
    return `### ${name} (${agent.id})\n\n${redactSecrets({ text: clipped.text })}`;
  });
  inventory.push({
    id: 'agents',
    label: 'agents',
    summary: `${kept.length} of ${ordered.length} agents, last message of each up to ${WIREFRAME_CONTEXT_LIMITS.agentText} characters`,
    state: keptRowState({ kept: kept.length, total: ordered.length }),
    detail:
      kept.length < ordered.length
        ? [`only the last ${WIREFRAME_CONTEXT_LIMITS.agents} fit, earlier agents are missing`]
        : [],
  });
  return `## product evidence\n\n${rows.join('\n\n')}`;
};

const planSection = ({
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
  const plans = artifacts.filter(
    (artifact) => artifact.kind === 'plan' && artifact.status !== 'discarded',
  );
  if (plans.length === 0) {
    inventory.push({
      id: 'plans',
      label: 'plans',
      summary: 'this session has no plan',
      state: 'missing',
      detail: [],
    });
    return '## plans\n\nthis session has no plan artifact.';
  }
  const kept = plans.slice(-WIREFRAME_CONTEXT_LIMITS.artifacts);
  if (kept.length < plans.length) {
    truncations.push(`plans: kept the last ${kept.length} of ${plans.length}`);
  }
  const rows = kept.map((plan) => {
    sourceIds.push(plan.id);
    const clipped = clip({
      text: plan.sourceText,
      limit: WIREFRAME_CONTEXT_LIMITS.artifactExcerpt,
    });
    if (clipped.isClipped) {
      truncations.push(`plan ${plan.id}: excerpt clipped`);
    }
    const title = redactSecrets({ text: plan.title });
    return `### ${title} (${plan.id})\n\n${redactSecrets({ text: clipped.text })}`;
  });
  inventory.push({
    id: 'plans',
    label: 'plans',
    summary: `${kept.length} of ${plans.length} session plans, first ${WIREFRAME_CONTEXT_LIMITS.artifactExcerpt} characters of each`,
    state: keptRowState({ kept: kept.length, total: plans.length }),
    detail: ['session plans, not scoped to a run'],
  });
  return `## plans\n\n${rows.join('\n\n')}`;
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
  inventory,
}: {
  readonly fidelity: WireframeFidelity;
  readonly designEvidence: DesignEvidence;
  readonly inventory: Array<ArtifactContextInventoryRow>;
}): string => {
  if (fidelity === 'low') {
    inventory.push({
      id: 'theme',
      label: 'theme',
      summary: 'plain wireframe, no design files read',
      state: 'missing',
      detail: [],
    });
    return [
      '## theme',
      'this is a low fidelity wireframe. set theme.name to "generic", leave theme.colors out, and lean on layout, hierarchy and node notes rather than styling.',
    ].join('\n\n');
  }
  if (designEvidence.source === 'none') {
    inventory.push({
      id: 'theme',
      label: 'theme',
      summary: 'no repository is mounted, so no design file was read',
      state: 'missing',
      detail: [],
    });
    return genericThemeSection({ reason: 'no repository is mounted, so nothing could be read' });
  }
  const profile = designEvidence.profile;
  if (!hasDesignEvidence({ profile })) {
    inventory.push({
      id: 'theme',
      label: 'theme',
      summary: 'the mounted repository was walked and no design file was found',
      state: 'missing',
      detail: profile.notes,
    });
    return genericThemeSection({
      reason: 'the mounted repository was walked and it holds no design file the app could read',
    });
  }
  inventory.push(themeProfileRow({ profile }));
  return [
    '## design profile',
    'this profile was read by the app from the mounted repository. use it for theme.name, theme.colors and the component vocabulary, and list the file paths you leaned on in theme.sources. never import or execute anything from the repository.',
    describeDesignProfile({ profile }),
  ].join('\n\n');
};

const scoutBlock = ({
  scoutPlan,
  scoutSection,
  inventory,
}: {
  readonly scoutPlan: WireframeScoutPlan | null;
  readonly scoutSection: string | null;
  readonly inventory: Array<ArtifactContextInventoryRow>;
}): ReadonlyArray<string> => {
  if (scoutPlan !== null) {
    inventory.push(wireframeScoutInventoryRow({ plan: scoutPlan }));
  }
  return scoutSection === null ? [] : [scoutSection];
};

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
  const sourceIds: Array<string> = [session.id];
  const truncations: Array<string> = [];
  const inventory: Array<ArtifactContextInventoryRow> = [];
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

  const goalBlock = goal.isDetailed ? [`## goal\n\n${goal.packText}`] : [];

  inventory.push(briefInventoryRow({ brief: request.text }));
  inventory.push(attachmentsInventoryRow({ attachments }));
  inventory.push({
    id: 'goal',
    label: 'goal',
    summary: 'the session goal and the fidelity',
    state: goal.isClipped ? 'partial' : 'included',
    detail: goal.isDetailed
      ? [`the goal you wrote, ${formatBriefCount({ value: goal.packText.length })} characters`]
      : [],
  });
  inventory.push({
    id: 'target',
    label: 'target',
    summary: `drawn for ${WIREFRAME_TARGET_LABEL[target]}`,
    state: 'included',
    detail: [WIREFRAME_TARGET_BRIEF[target]],
  });

  const attachmentsBlock = artifactAttachmentsSection({ attachments });
  const evidence = [
    header,
    ...goalBlock,
    ...(attachmentsBlock === null ? [] : [attachmentsBlock]),
    agentSection({ agents, transcripts, truncations, sourceIds, inventory }),
    planSection({ artifacts, truncations, sourceIds, inventory }),
    ...scoutBlock({ scoutPlan, scoutSection, inventory }),
    themeSection({ fidelity, designEvidence, inventory }),
  ].join('\n\n');

  const capped = clip({ text: evidence, limit: WIREFRAME_CONTEXT_LIMITS.total });
  if (capped.isClipped) {
    truncations.push(`evidence pack capped at ${WIREFRAME_CONTEXT_LIMITS.total} characters`);
  }
  const notes =
    truncations.length === 0
      ? '## truncation\n\nnothing was truncated.'
      : `## truncation\n\n${truncations.map((note) => `- ${note}`).join('\n')}`;

  const contract = `## document contract\n\n${WIREFRAME_SCHEMA_BRIEF}`;
  const sections = [
    ...(request.text.length > 0
      ? [`# user request\n\n${redactSecrets({ text: request.text })}`]
      : []),
    `${capped.text}\n\n${notes}\n\n${contract}`,
  ];
  inventory.push(excludedInventoryRow({ summary: WIREFRAME_EXCLUDED_COPY }));
  inventory.push(
    sizeInventoryRow({
      size: evidence.length,
      cap: WIREFRAME_CONTEXT_LIMITS.total,
      isCapped: capped.isClipped,
    }),
  );
  return { text: sections.join('\n\n'), sourceIds, truncations, inventory };
};
