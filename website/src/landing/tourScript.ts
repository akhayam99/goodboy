import type { CameraKey } from './camera';
import type { KindKey } from '../mockups/primitives';

export type StepStatus = 'future' | 'actionable' | 'running' | 'done';
export type GhPhase = 'open' | 'resolving' | 'committed' | 'resolved' | 'merged';
export type RightMode = 'context' | 'plans' | 'github';

export interface ChatTurn {
  readonly id: string;
  readonly role: 'user' | 'agent';
  readonly kind?: KindKey;
  readonly text: string;
  readonly at: number;
}

export interface TourView {
  act: number;
  chatCount: number;
  rightMode: RightMode;
  decisions: number;
  questionShown: boolean;
  questionPicked: number | null;
  planShown: boolean;
  autoRun: boolean;
  steps: StepStatus[];
  clusters: StepStatus[];
  prOpen: boolean;
  ghPhase: GhPhase;
}

export const SESSION_GOAL =
  'Add password reset via email link. Reuse the existing mailer. Keep the login UI untouched.';

export const CHAT_TURNS: ReadonlyArray<ChatTurn> = [
  { id: 'goal', role: 'user', text: SESSION_GOAL, at: 0.2 },
  {
    id: 'scout',
    role: 'agent',
    kind: 'scout',
    text: 'Mapped the auth surface: three call sites, the mailer, the session store. No reset flow exists yet.',
    at: 0.25,
  },
  {
    id: 'plan',
    role: 'agent',
    kind: 'plan',
    text: 'Plan: a hashed single-use token (60m TTL), POST /auth/reset-request, the email template, the reset form. Four steps.',
    at: 0.31,
  },
  {
    id: 'imple',
    role: 'agent',
    kind: 'imple',
    text: 'Building it in parallel: token model, request handler, email template.',
    at: 0.66,
  },
  {
    id: 'pr',
    role: 'agent',
    kind: 'review',
    text: 'Opened PR #214 (feat(auth): password reset). Endpoint and handler tests are green.',
    at: 0.785,
  },
  {
    id: 'comment',
    role: 'agent',
    kind: 'review',
    text: 'Review comment: hash with argon2id instead of sha256. Handing it to a resolve agent.',
    at: 0.86,
  },
  {
    id: 'resolved',
    role: 'agent',
    kind: 'imple',
    text: 'Committed a1b2c3d on ak/password-reset. The comment is resolved.',
    at: 0.93,
  },
];

export const DECISIONS: ReadonlyArray<string> = [
  'Token TTL 60 minutes, single-use.',
  'Rate-limit requests per email at 3 per hour.',
  'Hash tokens with argon2id, not sha256.',
];

export const OPEN_QUESTION =
  'Cap reset tokens at one active per account, or allow several in flight?';
export const QUESTION_SUGGESTIONS: ReadonlyArray<string> = [
  'One active at a time',
  'Allow up to three',
];

export const RUN_STEPS: ReadonlyArray<{ kind: KindKey; name: string; model: string }> = [
  { kind: 'scout', name: 'Locate auth surface', model: 'haiku-4-5' },
  { kind: 'plan', name: 'Draft reset flow + endpoints', model: 'opus-4-7' },
  { kind: 'imple', name: 'Build endpoint + email', model: 'sonnet-4-5' },
  { kind: 'review', name: 'Open PR for review', model: 'sonnet-4-5' },
];

export const CLUSTERS: ReadonlyArray<string> = ['token model', 'request handler', 'email template'];

export const PLAN = {
  title: 'Password reset rollout',
  steps: [
    'Token model (hashed, 60m TTL)',
    'POST /auth/reset-request handler',
    'Email template + send',
    'Frontend form on /reset/[token]',
  ],
  consumed: {
    title: 'Rate-limit transactional mail',
    note: 'Consumed by the Implement step. Folded into the endpoint and email work.',
  },
};

export const PR = {
  num: 214,
  title: 'feat(auth): password reset',
  branch: 'ak/password-reset',
  comment: 'Hash with argon2id instead of sha256.',
  sha: 'a1b2c3d',
};

export interface Caption {
  readonly eyebrow: string;
  readonly line: string;
}

export const CAPTIONS: ReadonlyArray<Caption> = [
  { eyebrow: 'The workspace', line: 'Every task you have running, in one window.' },
  {
    eyebrow: '01 · Sessions',
    line: 'Each task keeps its own goal, branch and agents. Pick one up exactly where you left it.',
  },
  {
    eyebrow: '02 · Scout, then plan',
    line: 'A scout reads the codebase first. Then it drafts a plan, before touching a line.',
  },
  {
    eyebrow: '03 · Shared context',
    line: 'Goal, decisions and open questions sit beside the chat, so the next agent inherits them.',
  },
  {
    eyebrow: '04 · Plans',
    line: 'Plans you can read and reuse. A spent one folds into the work that consumed it.',
  },
  {
    eyebrow: '05 · Autorun',
    line: 'Hand off the plan. Subagents build it in parallel and open the PR for you.',
  },
  {
    eyebrow: '06 · Review',
    line: 'A review comment becomes a resolve agent. It commits the fix and the PR goes green.',
  },
];

export const KEYFRAMES: ReadonlyArray<CameraKey> = [
  { at: 0.0, region: 'app' },
  { at: 0.05, region: 'app' },
  { at: 0.12, region: 'rail' },
  { at: 0.18, region: 'rail' },
  { at: 0.25, region: 'chat' },
  { at: 0.37, region: 'chat' },
  { at: 0.47, region: 'right' },
  { at: 0.62, region: 'right' },
  { at: 0.69, region: 'chat' },
  { at: 0.8, region: 'chat' },
  { at: 0.86, region: 'right' },
  { at: 1.0, region: 'right' },
];

const STEP_RUN = [0.225, 0.315, 0.66, 0.75];
const STEP_DONE = [0.305, 0.365, 0.745, 0.795];
const CLUSTER_DONE = [0.685, 0.705, 0.725];

function stepStatus(i: number, p: number): StepStatus {
  if (p >= STEP_DONE[i]) return 'done';
  if (p >= STEP_RUN[i]) return 'running';
  if (i === 0 || p >= STEP_DONE[i - 1]) return 'actionable';
  return 'future';
}

function clusterStatus(i: number, p: number): StepStatus {
  if (p >= CLUSTER_DONE[i]) return 'done';
  if (p >= 0.66) return 'running';
  return 'future';
}

function actAt(p: number): number {
  if (p < 0.07) return 0;
  if (p < 0.19) return 1;
  if (p < 0.37) return 2;
  if (p < 0.52) return 3;
  if (p < 0.63) return 4;
  if (p < 0.82) return 5;
  return 6;
}

function ghPhaseAt(p: number): GhPhase {
  if (p >= 0.985) return 'merged';
  if (p >= 0.935) return 'resolved';
  if (p >= 0.9) return 'committed';
  if (p >= 0.865) return 'resolving';
  return 'open';
}

export function deriveView(p: number): TourView {
  return {
    act: actAt(p),
    chatCount: CHAT_TURNS.filter((t) => p >= t.at).length,
    rightMode: p >= 0.82 ? 'github' : p >= 0.52 ? 'plans' : 'context',
    decisions: [0.4, 0.435, 0.47].filter((t) => p >= t).length,
    questionShown: p >= 0.485,
    questionPicked: p >= 0.5 ? 0 : null,
    planShown: p >= 0.545,
    autoRun: p >= 0.645,
    steps: [0, 1, 2, 3].map((i) => stepStatus(i, p)),
    clusters: [0, 1, 2].map((i) => clusterStatus(i, p)),
    prOpen: p >= 0.79,
    ghPhase: ghPhaseAt(p),
  };
}

export function equalView(a: TourView, b: TourView): boolean {
  return (
    a.act === b.act &&
    a.chatCount === b.chatCount &&
    a.rightMode === b.rightMode &&
    a.decisions === b.decisions &&
    a.questionShown === b.questionShown &&
    a.questionPicked === b.questionPicked &&
    a.planShown === b.planShown &&
    a.autoRun === b.autoRun &&
    a.prOpen === b.prOpen &&
    a.ghPhase === b.ghPhase &&
    a.steps.every((s, i) => s === b.steps[i]) &&
    a.clusters.every((s, i) => s === b.clusters[i])
  );
}
