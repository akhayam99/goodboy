import type { DelegationResultV1, ResultArtifact } from './result';
import type { AutoDelegationRole } from './roles';

const ADOPTION_KINDS = [
  'scout',
  'planner',
  'debugger',
  'reviewer',
  'implementer',
  'tester',
  'docs',
  'generic',
] as const;

export type AdoptionKind = (typeof ADOPTION_KINDS)[number];

const ADOPTION_ROLE_OF_KIND = {
  scout: 'scout',
  planner: 'planner',
  debugger: 'investigator',
  reviewer: 'reviewer',
  implementer: 'implementer',
  tester: 'tester',
  docs: 'docs',
  generic: 'implementer',
} as const satisfies Readonly<Record<AdoptionKind, AutoDelegationRole>>;

const ADOPTION_RESULT_REASON = 'Adopted from a standalone agent';

export const ADOPTION_DEFAULT_INSTRUCTION =
  'Nothing was added. Read the transcript summary and decide what the next step is.';

const ADOPTION_SUMMARY_CHARS = 1_500;

const ADOPTION_GOAL_CHARS = 1_000;

type KindParams = {
  readonly kind: string;
};

const adoptionKindOf = ({ kind }: KindParams): AdoptionKind | null =>
  ADOPTION_KINDS.find((candidate) => candidate === kind) ?? null;

export const isAdoptableKind = ({ kind }: KindParams): boolean => adoptionKindOf({ kind }) !== null;

export const adoptionRoleOf = ({ kind }: KindParams): AutoDelegationRole | null => {
  const adoptable = adoptionKindOf({ kind });
  return adoptable === null ? null : ADOPTION_ROLE_OF_KIND[adoptable];
};

const ADOPTION_REFUSAL_CODES = [
  'agent_gone',
  'not_adoptable',
  'in_run',
  'turn_running',
  'already_in_auto',
  'cycle',
] as const;

export type AdoptionRefusalCode = (typeof ADOPTION_REFUSAL_CODES)[number];

export const ADOPTION_REFUSAL_TEXT = {
  agent_gone: 'This agent is no longer in the session.',
  not_adoptable: 'Auto can take over implementers, testers, analysis agents and Generalists.',
  in_run: 'Pause or finish the run first.',
  turn_running: 'Wait for the turn to end first.',
  already_in_auto: 'This agent already belongs to an Auto conversation.',
  cycle: 'This agent is linked to an Auto conversation, so Auto cannot take it over.',
} as const satisfies Readonly<Record<AdoptionRefusalCode, string>>;

export type AdoptionSnapshot = Readonly<{
  isGone: boolean;
  kind: string;
  hasRunStep: boolean;
  isTurnLive: boolean;
  isInAuto: boolean;
  isLinkedToAuto: boolean;
}>;

export const diagnoseAdoption = (snapshot: AdoptionSnapshot): AdoptionRefusalCode | null => {
  if (snapshot.isGone) {
    return 'agent_gone';
  }
  if (!isAdoptableKind({ kind: snapshot.kind })) {
    return 'not_adoptable';
  }
  if (snapshot.hasRunStep) {
    return 'in_run';
  }
  if (snapshot.isInAuto) {
    return 'already_in_auto';
  }
  if (snapshot.isLinkedToAuto) {
    return 'cycle';
  }
  if (snapshot.isTurnLive) {
    return 'turn_running';
  }
  return null;
};

export type AdoptionArtifactRef = Readonly<{
  id: string;
  kind: 'plan' | 'report';
  title: string;
  revision: number;
}>;

export type AdoptionKickoffParams = Readonly<{
  sourceName: string;
  roleLabel: string;
  goal: string;
  lastReply: string;
  artifacts: ReadonlyArray<AdoptionArtifactRef>;
  mountLabel: string | null;
  instruction: string;
}>;

type ClipParams = {
  readonly text: string;
  readonly max: number;
};

const oneBlock = ({ text, max }: ClipParams): string => {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max).trimEnd()}...`;
};

export const composeAdoptionKickoff = ({
  sourceName,
  roleLabel,
  goal,
  lastReply,
  artifacts,
  mountLabel,
  instruction,
}: AdoptionKickoffParams): string => {
  const parts: string[] = [
    `The user moved ${sourceName}, a ${roleLabel} agent that was working on its own, to you. It keeps its chat and its files. It does not take new messages from the user now: you decide what happens next and hand new work to new agents.`,
  ];
  const goalText = oneBlock({ text: goal, max: ADOPTION_GOAL_CHARS });
  if (goalText !== '') {
    parts.push(`What the user asked ${sourceName}\n${goalText}`);
  }
  const replyText = oneBlock({ text: lastReply, max: ADOPTION_SUMMARY_CHARS });
  if (replyText !== '') {
    parts.push(`What ${sourceName} said last\n${replyText}`);
  }
  if (artifacts.length > 0) {
    parts.push(
      [
        `Artifacts ${sourceName} made, now yours`,
        ...artifacts.map(
          (artifact) =>
            `- ${artifact.id} (${artifact.kind}) "${artifact.title}" version ${artifact.revision}`,
        ),
      ].join('\n'),
    );
  }
  if (mountLabel !== null) {
    parts.push(`Where it worked\n${mountLabel}`);
  }
  const instructionText = instruction.trim();
  parts.push(
    `What the user wants next\n${instructionText === '' ? ADOPTION_DEFAULT_INSTRUCTION : instructionText}`,
  );
  return parts.join('\n\n');
};

export type AdoptedResultParams = Readonly<{
  delegationId: string;
  attemptId: string;
  treeId: string;
  childAgentId: string;
  role: AutoDelegationRole;
  routing: Readonly<{ provider: string; model: string; effort: string }>;
  summary: string;
  artifacts: ReadonlyArray<ResultArtifact>;
}>;

export const buildAdoptedResult = ({
  delegationId,
  attemptId,
  treeId,
  childAgentId,
  role,
  routing,
  summary,
  artifacts,
}: AdoptedResultParams): DelegationResultV1 => ({
  schemaVersion: 1,
  delegationId,
  attemptId,
  treeId,
  generation: 1,
  childAgentId,
  role,
  routing: { ...routing, reason: ADOPTION_RESULT_REASON },
  outcome: 'completed',
  process: { exit: 'ok', turns: 0, durationMs: 0 },
  declared: {
    completion: 'done',
    summary: oneBlock({ text: summary, max: ADOPTION_SUMMARY_CHARS }),
    summarySource: summary.trim() === '' ? 'none' : 'child',
  },
  verified: { changedFiles: [], checks: [] },
  artifacts,
  artifactPersistence: artifacts.length === 0 ? 'not_applicable' : 'ok',
  openQuestions: [],
  cost: { usd: null, basis: 'estimate' },
  reason: null,
});
