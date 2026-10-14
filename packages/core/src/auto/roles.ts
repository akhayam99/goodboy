import type { AgentRole } from '@goodboy/types';

export const AUTO_DELEGATION_ROLES = [
  'scout',
  'planner',
  'investigator',
  'reviewer',
  'implementer',
  'tester',
  'docs',
] as const satisfies ReadonlyArray<AgentRole>;

export type AutoDelegationRole = (typeof AUTO_DELEGATION_ROLES)[number];

export const AUTO_WRITER_ROLES = [
  'implementer',
  'tester',
  'docs',
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
} as const satisfies Readonly<Record<AutoDelegationRole, AutoArtifactKind | null>>;

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
