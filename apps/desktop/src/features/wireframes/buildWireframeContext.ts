import { WIREFRAME_SCHEMA_BRIEF } from '@goodboy/core';
import type { Agent, IsoDateTime, Session, SessionArtifact, TurnEvent } from '@goodboy/types';
import { redactSecrets } from '../../shared/utils/redactSecrets';
import type { DesignProfile } from './collectDesignProfile';
import { describeDesignProfile } from './describeDesignProfile';
import { WIREFRAME_FIDELITY_LABEL, type WireframeFidelity } from './wireframeFidelity';

export const WIREFRAME_CONTEXT_LIMITS = {
  agents: 8,
  agentText: 900,
  artifacts: 6,
  artifactExcerpt: 700,
  total: 40_000,
} as const;

export type WireframeContextParams = Readonly<{
  fidelity: WireframeFidelity;
  session: Session;
  agents: ReadonlyArray<Agent>;
  transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  artifacts: ReadonlyArray<SessionArtifact>;
  designProfile: DesignProfile | null;
  capturedAt: IsoDateTime;
}>;

export type WireframeContext = Readonly<{
  text: string;
  sourceIds: ReadonlyArray<string>;
  truncations: ReadonlyArray<string>;
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
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly transcripts: WireframeContextParams['transcripts'];
  readonly truncations: Array<string>;
  readonly sourceIds: Array<string>;
}): string => {
  if (agents.length === 0) {
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
  return `## product evidence\n\n${rows.join('\n\n')}`;
};

const planSection = ({
  artifacts,
  truncations,
  sourceIds,
}: {
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly truncations: Array<string>;
  readonly sourceIds: Array<string>;
}): string => {
  const plans = artifacts.filter(
    (artifact) => artifact.kind === 'plan' && artifact.status !== 'discarded',
  );
  if (plans.length === 0) {
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
  return `## plans\n\n${rows.join('\n\n')}`;
};

const themeSection = ({
  fidelity,
  designProfile,
}: {
  readonly fidelity: WireframeFidelity;
  readonly designProfile: DesignProfile | null;
}): string => {
  if (fidelity === 'low') {
    return [
      '## theme',
      'this is a low fidelity wireframe. set theme.name to "generic", leave theme.colors out, and lean on layout, hierarchy and node notes rather than styling.',
    ].join('\n\n');
  }
  if (designProfile === null) {
    return [
      '## theme',
      'high fidelity was requested but the app collected no design profile. set theme.name to "generic", never invent branding, and say in a node note that the theme is generic.',
    ].join('\n\n');
  }
  return [
    '## design profile',
    'this profile was read by the app from the mounted repository. use it for theme.name, theme.colors and the component vocabulary, and list the file paths you leaned on in theme.sources. never import or execute anything from the repository.',
    describeDesignProfile({ profile: designProfile }),
  ].join('\n\n');
};

export const buildWireframeContext = ({
  fidelity,
  session,
  agents,
  transcripts,
  artifacts,
  designProfile,
  capturedAt,
}: WireframeContextParams): WireframeContext => {
  const sourceIds: Array<string> = [];
  const truncations: Array<string> = [];
  const header = [
    `# ${WIREFRAME_FIDELITY_LABEL[fidelity].toLowerCase()} wireframe request`,
    `session goal: ${redactSecrets({ text: session.goal })}`,
    `captured at: ${capturedAt}`,
    'produce one wireframe document for this product from the evidence below. cover the screens the goal actually needs, and wire the transitions a user would take between them.',
    'this pack is the only evidence you have. it carries final agent messages, not tool calls or tool output. never invent a product fact that is not here; put what is missing in a node note.',
  ].join('\n');

  const evidence = [
    header,
    agentSection({ agents, transcripts, truncations, sourceIds }),
    planSection({ artifacts, truncations, sourceIds }),
    themeSection({ fidelity, designProfile }),
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
  return { text: `${capped.text}\n\n${notes}\n\n${contract}`, sourceIds, truncations };
};
