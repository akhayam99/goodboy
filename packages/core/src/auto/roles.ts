import type { AgentRole } from '@goodboy/types';

export const AUTO_DELEGATION_ROLES = [
  'scout',
  'planner',
  'investigator',
  'reviewer',
  'implementer',
  'tester',
  'docs',
  'scribe',
  'ci-fixer',
  'rewriter',
] as const satisfies ReadonlyArray<AgentRole>;

export type AutoDelegationRole = (typeof AUTO_DELEGATION_ROLES)[number];

export const AUTO_WRITER_ROLES = [
  'implementer',
  'tester',
  'docs',
  'scribe',
  'ci-fixer',
  'rewriter',
] as const satisfies ReadonlyArray<AutoDelegationRole>;

export type AutoWriterRole = (typeof AUTO_WRITER_ROLES)[number];

export type AutoArtifactKind = 'plan' | 'report';

export const AUTO_ROLE_ARTIFACT = {
  scout: 'report',
  planner: 'plan',
  investigator: 'report',
  reviewer: 'report',
  implementer: null,
  tester: null,
  docs: null,
  scribe: null,
  'ci-fixer': null,
  rewriter: null,
} as const satisfies Readonly<Record<AutoDelegationRole, AutoArtifactKind | null>>;

export const AUTO_ROLE_WHEN = {
  scout:
    'find where something is in the code or how it works today, when you cannot read it fast yourself',
  planner: 'turn a request into steps with risks and checks before anything changes',
  investigator: 'diagnose a failure, a crash or a wrong result and find its cause',
  reviewer: 'judge a change that already exists and list what is wrong with it',
  implementer: 'change code, commit it, reinstall dependencies or fix what an investigator found',
  tester: 'write or fix tests for a named behavior',
  docs: 'write documentation, a README or a changelog in the repository',
  scribe:
    'write the pull request of the branch and open it, as a draft unless the user asks otherwise',
  'ci-fixer': 'make a failing check of the branch pass and commit the fix, never push',
  rewriter:
    'rewrite or tidy the commit history of the branch: squash, reword, reorder or split commits',
} as const satisfies Readonly<Record<AutoDelegationRole, string>>;

type ParseAutoDelegationRoleParams = {
  readonly role: unknown;
};

export const parseAutoDelegationRole = ({
  role,
}: ParseAutoDelegationRoleParams): AutoDelegationRole | null =>
  AUTO_DELEGATION_ROLES.find((candidate) => candidate === role) ?? null;

type AutoRoleParams = {
  readonly role: AutoDelegationRole;
};

export const isAutoWriterRole = ({ role }: AutoRoleParams): boolean =>
  AUTO_WRITER_ROLES.some((candidate) => candidate === role);
