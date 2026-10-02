export type AgentKind =
  | 'scout'
  | 'planner'
  | 'implementer'
  | 'debugger'
  | 'tester'
  | 'reviewer'
  | 'pr-reviewer'
  | 'docs'
  | 'report'
  | 'wireframe'
  | 'resolver'
  | 'rewriter'
  | 'scribe'
  | 'generic';

export type KindPaletteEntry = {
  readonly label: string;
  readonly color: string;
};

export const AGENT_KIND_PALETTE: Record<AgentKind, KindPaletteEntry> = {
  scout: { label: 'Scout', color: 'var(--g-agent-scout)' },
  planner: { label: 'Planner', color: 'var(--g-agent-planner)' },
  implementer: { label: 'Implementer', color: 'var(--g-agent-implementer)' },
  debugger: { label: 'Debugger', color: 'var(--g-agent-debugger)' },
  tester: { label: 'Tester', color: 'var(--g-agent-tester)' },
  reviewer: { label: 'Reviewer', color: 'var(--g-agent-reviewer)' },
  'pr-reviewer': { label: 'PR reviewer', color: 'var(--g-agent-pr-reviewer)' },
  docs: { label: 'Docs', color: 'var(--g-agent-docs)' },
  report: { label: 'Report', color: 'var(--g-agent-report)' },
  wireframe: { label: 'Wireframe', color: 'var(--g-agent-wireframe)' },
  resolver: { label: 'Resolver', color: 'var(--g-agent-resolver)' },
  rewriter: { label: 'History rewriter', color: 'var(--g-agent-rewriter)' },
  scribe: { label: 'Scribe', color: 'var(--g-agent-scribe)' },
  generic: { label: 'Generalist', color: 'var(--g-agent-generic)' },
};

export const UNKNOWN_KIND_COLOR = 'var(--g-muted-foreground)';

export type Tone =
  'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'primary' | 'merged' | 'draft';

export const TONE_COLOR: Record<Tone, string> = {
  neutral: 'var(--g-muted-foreground)',
  success: 'var(--g-success)',
  info: 'var(--g-info)',
  warning: 'var(--g-warning)',
  danger: 'var(--g-danger)',
  primary: 'var(--g-primary)',
  merged: 'var(--g-merged)',
  draft: 'var(--g-draft)',
};

export type WorkNodeState =
  | 'queued'
  | 'ready'
  | 'running'
  | 'question'
  | 'budget'
  | 'approval'
  | 'failed'
  | 'done'
  | 'closed'
  | 'stopped'
  | 'skipped'
  | 'marker'
  | 'mixed';

export type RowNodeState = Exclude<WorkNodeState, 'marker' | 'mixed'>;

export const WORK_NODE_SIZE = 20;
export const WORK_NODE_SIZE_SM = 14;
export const WORK_NODE_GLYPH_SIZE = 12;
export const WORK_NODE_GLYPH_SIZE_SM = 9;

export const WORK_NODE_ARC = { radius: 9, strokeWidth: 2, headRadius: 1.75 } as const;

export const WORK_NODE_MIXED = { radius: 8.75, strokeWidth: 2, gap: 1.5 } as const;

const QUEUED_DASH = '2.6 2.1';

type RingSpec = {
  readonly radius: number;
  readonly strokeWidth: number;
  readonly stroke: string;
  readonly fill: string;
  readonly dashArray: string | null;
};

const NO_FILL = 'none';

export const WORK_NODE_RING: Record<RowNodeState, RingSpec> = {
  queued: {
    radius: 9.25,
    strokeWidth: 1.5,
    stroke: 'var(--g-faint-foreground)',
    fill: NO_FILL,
    dashArray: QUEUED_DASH,
  },
  ready: {
    radius: 9.25,
    strokeWidth: 1.5,
    stroke: 'var(--g-warning)',
    fill: NO_FILL,
    dashArray: QUEUED_DASH,
  },
  running: {
    radius: 9,
    strokeWidth: 2,
    stroke: 'var(--g-border-soft)',
    fill: NO_FILL,
    dashArray: null,
  },
  question: {
    radius: 9.25,
    strokeWidth: 1.5,
    stroke: 'var(--g-warning)',
    fill: NO_FILL,
    dashArray: null,
  },
  budget: {
    radius: 9.25,
    strokeWidth: 1.5,
    stroke: 'var(--g-warning)',
    fill: NO_FILL,
    dashArray: null,
  },
  approval: {
    radius: 9.25,
    strokeWidth: 1.5,
    stroke: 'var(--g-warning)',
    fill: NO_FILL,
    dashArray: null,
  },
  failed: {
    radius: 9.25,
    strokeWidth: 1.5,
    stroke: 'var(--g-danger)',
    fill: NO_FILL,
    dashArray: null,
  },
  done: {
    radius: 9.5,
    strokeWidth: 1,
    stroke: 'color-mix(in oklab, var(--g-success) 70%, transparent)',
    fill: 'color-mix(in oklab, var(--g-success) 18%, transparent)',
    dashArray: null,
  },
  closed: {
    radius: 9.5,
    strokeWidth: 1,
    stroke: 'var(--g-border)',
    fill: NO_FILL,
    dashArray: null,
  },
  stopped: {
    radius: 9.5,
    strokeWidth: 1,
    stroke: 'var(--g-border)',
    fill: NO_FILL,
    dashArray: null,
  },
  skipped: {
    radius: 9.5,
    strokeWidth: 1,
    stroke: 'var(--g-border-soft)',
    fill: NO_FILL,
    dashArray: null,
  },
};

const ROW_NODE_LABEL: Record<RowNodeState, string> = {
  queued: 'Not started',
  ready: 'Ready to run',
  running: 'Running',
  question: 'Waiting on your answer',
  budget: 'Paused at the spend limit',
  approval: 'Waiting for your approval',
  failed: 'Failed',
  done: 'Done',
  closed: 'Closed by you',
  stopped: 'Stopped by you',
  skipped: 'Skipped',
};

export const MIXED_TONE_STROKE: Record<Tone, string> = {
  success: 'var(--g-success)',
  info: 'var(--g-info)',
  warning: 'var(--g-warning)',
  danger: 'var(--g-danger)',
  primary: 'var(--g-primary)',
  merged: 'var(--g-merged)',
  draft: 'var(--g-faint-foreground)',
  neutral: 'var(--g-faint-foreground)',
};

export type MixedPart = {
  readonly tone: Tone;
  readonly count: number;
};

export type MixedArc = {
  readonly tone: Tone;
  readonly count: number;
  readonly length: number;
  readonly offset: number;
};

export const workNodeMixedArcs = ({
  parts,
  radius,
  gap,
}: {
  readonly parts: ReadonlyArray<MixedPart>;
  readonly radius: number;
  readonly gap: number;
}): ReadonlyArray<MixedArc> => {
  const counted = parts.filter((part) => part.count > 0);
  const total = counted.reduce((sum, part) => sum + part.count, 0);
  if (total === 0) {
    return [];
  }
  const circumference = 2 * Math.PI * radius;
  const gaps = counted.length > 1 ? gap * counted.length : 0;
  const unit = (circumference - gaps) / total;
  const arcs: MixedArc[] = [];
  let position = gaps === 0 ? 0 : gap / 2;
  for (const part of counted) {
    const length = part.count * unit;
    arcs.push({ tone: part.tone, count: part.count, length, offset: position });
    position += length + (gaps === 0 ? 0 : gap);
  }
  return arcs;
};

export type RowPhase = 'queued' | 'running' | 'waiting' | 'failed' | 'done' | 'closed' | 'skipped';

export type RowSentenceReason =
  | { readonly kind: 'ready'; readonly stepLabel?: string }
  | { readonly kind: 'question'; readonly stepLabel?: string }
  | { readonly kind: 'budget'; readonly limit?: string }
  | { readonly kind: 'failed' }
  | { readonly kind: 'blocked' }
  | { readonly kind: 'noArtifact' }
  | { readonly kind: 'needsApproval' }
  | { readonly kind: 'stepFailed'; readonly stepLabel?: string }
  | { readonly kind: 'stepBlocked'; readonly stepLabel?: string }
  | { readonly kind: 'orchestratorFailed' }
  | { readonly kind: 'stopped' }
  | { readonly kind: 'agentStopped'; readonly by: 'app' | 'user' }
  | { readonly kind: 'stepStopped'; readonly stepLabel?: string }
  | { readonly kind: 'deciding' }
  | { readonly kind: 'briefing' }
  | { readonly kind: 'closed' }
  | { readonly kind: 'skipped' }
  | { readonly kind: 'chained'; readonly afterTitle: string };

export const reasonSentence = (reason: RowSentenceReason): string => {
  switch (reason.kind) {
    case 'ready':
      return reason.stepLabel === undefined
        ? 'Ready to run'
        : `Step ${reason.stepLabel} is ready to run`;
    case 'question':
      return reason.stepLabel === undefined
        ? 'Needs your answer'
        : `Needs your answer in step ${reason.stepLabel}`;
    case 'budget':
      return reason.limit === undefined
        ? 'Paused at the spend limit'
        : `Paused at the ${reason.limit} spend limit`;
    case 'failed':
      return 'Failed';
    case 'blocked':
      return 'Blocked, tell the agent what to do next';
    case 'noArtifact':
      return 'No artifact, use Retry capture in the transcript';
    case 'needsApproval':
      return 'Needs approval, answer the request in the transcript';
    case 'stepFailed':
      return reason.stepLabel === undefined ? 'A step failed' : `Step ${reason.stepLabel} failed`;
    case 'stepBlocked':
      return reason.stepLabel === undefined
        ? 'A step is blocked, tell the agent what to do next'
        : `Step ${reason.stepLabel} is blocked, tell the agent what to do next`;
    case 'orchestratorFailed':
      return 'The orchestrator failed';
    case 'stopped':
      return 'Stopped by you';
    case 'agentStopped':
      return reason.by === 'app' ? 'Stopped by restart' : 'Stopped by you';
    case 'stepStopped':
      return reason.stepLabel === undefined
        ? 'A step was stopped'
        : `Step ${reason.stepLabel} stopped by you`;
    case 'deciding':
      return 'Choosing the next step';
    case 'briefing':
      return 'Briefing the next step';
    case 'closed':
      return 'Closed by you';
    case 'skipped':
      return 'Skipped';
    case 'chained':
      return `Starts after ${reason.afterTitle}`;
  }
};

export const reasonShortSentence = (reason: RowSentenceReason): string => {
  switch (reason.kind) {
    case 'ready':
      return reason.stepLabel === undefined ? 'Ready' : `Step ${reason.stepLabel} ready`;
    case 'question':
      return 'Needs you';
    case 'budget':
      return 'At spend limit';
    case 'orchestratorFailed':
      return 'Orchestrator failed';
    case 'stopped':
    case 'agentStopped':
    case 'stepStopped':
      return 'Stopped';
    case 'deciding':
      return 'Choosing next';
    case 'briefing':
      return 'Briefing';
    case 'closed':
      return 'Closed';
    case 'chained':
      return 'Chained';
    case 'blocked':
      return 'Blocked';
    case 'noArtifact':
      return 'No artifact';
    case 'needsApproval':
      return 'Needs approval';
    case 'stepBlocked':
      return reason.stepLabel === undefined ? 'Step blocked' : `Step ${reason.stepLabel} blocked`;
    case 'failed':
    case 'stepFailed':
    case 'skipped':
      return reasonSentence(reason);
  }
};

export const NEUTRAL_REASONS: ReadonlySet<RowSentenceReason['kind']> = new Set([
  'agentStopped',
  'stepStopped',
]);

export const PHASE_TONE: Record<RowPhase, Tone> = {
  queued: 'neutral',
  running: 'neutral',
  waiting: 'warning',
  failed: 'danger',
  done: 'neutral',
  closed: 'neutral',
  skipped: 'neutral',
};

export type RowStateInput = {
  readonly phase: RowPhase;
  readonly reason?: RowSentenceReason;
};

export const rowStateTone = ({ phase, reason }: RowStateInput): Tone =>
  reason !== undefined && NEUTRAL_REASONS.has(reason.kind) ? 'neutral' : PHASE_TONE[phase];

export const rowStateNodeState = ({ phase, reason }: RowStateInput): RowNodeState => {
  switch (phase) {
    case 'queued':
      return 'queued';
    case 'running':
      return 'running';
    case 'waiting':
      if (reason?.kind === 'agentStopped' || reason?.kind === 'stepStopped') {
        return 'stopped';
      }
      if (reason?.kind === 'ready') {
        return 'ready';
      }
      if (reason?.kind === 'budget') {
        return 'budget';
      }
      if (
        reason?.kind === 'blocked' ||
        reason?.kind === 'stepBlocked' ||
        reason?.kind === 'noArtifact'
      ) {
        return 'approval';
      }
      return 'question';
    case 'failed':
      return 'failed';
    case 'done':
      return 'done';
    case 'closed':
      return reason?.kind === 'stopped' ? 'stopped' : 'closed';
    case 'skipped':
      return 'skipped';
  }
};

export const rowStateNodeLabel = (input: RowStateInput): string => {
  const { reason } = input;
  if (reason?.kind === 'deciding') {
    return reasonSentence(reason);
  }
  if (reason?.kind === 'blocked' || reason?.kind === 'stepBlocked') {
    return 'Blocked';
  }
  if (reason?.kind === 'noArtifact') {
    return 'No artifact';
  }
  if (reason?.kind === 'needsApproval') {
    return 'Needs approval';
  }
  if (reason?.kind === 'agentStopped' && reason.by === 'app') {
    return 'Stopped by restart';
  }
  return ROW_NODE_LABEL[rowStateNodeState(input)];
};

export type TimelineRowGrade = 'entry' | 'step' | 'pending';

export type TimelineGap = 'none' | 'sibling' | 'entry';

export const TIMELINE_GRADE = {
  entry: { lineHeight: 20, height: 40 },
  step: { lineHeight: 16, height: 32 },
  pending: { lineHeight: 16, height: 26 },
} as const satisfies Record<TimelineRowGrade, { lineHeight: number; height: number }>;

export const TIMELINE_GAP = {
  none: 0,
  sibling: 4,
  entry: 12,
} as const satisfies Record<TimelineGap, number>;

export const rowBoxHeight = ({
  grade,
  gap,
}: {
  readonly grade: TimelineRowGrade;
  readonly gap: TimelineGap;
}): number => TIMELINE_GAP[gap] + TIMELINE_GRADE[grade].height;

export const markerCenterY = ({
  grade,
  gap,
}: {
  readonly grade: TimelineRowGrade;
  readonly gap: TimelineGap;
}): number => {
  const { lineHeight, height } = TIMELINE_GRADE[grade];
  return TIMELINE_GAP[gap] + (height - lineHeight) / 2 + lineHeight / 2;
};
