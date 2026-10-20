import type { AutoDelegationRole } from './roles';

export const AUTO_SUBSTEP_ROLES = [
  'scout',
  'investigator',
] as const satisfies ReadonlyArray<AutoDelegationRole>;

export type AutoSubstepRole = (typeof AUTO_SUBSTEP_ROLES)[number];

type RoleParams = {
  readonly role: unknown;
};

export const parseSubstepNeeds = ({ role }: RoleParams): AutoSubstepRole | null =>
  AUTO_SUBSTEP_ROLES.find((candidate) => candidate === role) ?? null;

export const isAutoSubstepRole = ({ role }: RoleParams): boolean =>
  parseSubstepNeeds({ role }) !== null;

export type SubstepLink = Readonly<{
  delegationId: string;
  questionId: string;
  depth: number;
}>;

type RequestParams = {
  readonly request: Readonly<Record<string, unknown>>;
};

type RecordValue = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const substepLinkOf = ({ request }: RequestParams): SubstepLink | null => {
  const parent = request['parent'];
  if (!isRecord(parent)) {
    return null;
  }
  const delegationId = parent['delegationId'];
  const questionId = parent['questionId'];
  const depth = parent['depth'];
  if (
    typeof delegationId !== 'string' ||
    typeof questionId !== 'string' ||
    typeof depth !== 'number'
  ) {
    return null;
  }
  return { delegationId, questionId, depth };
};

export const delegationDepthOf = ({ request }: RequestParams): number =>
  substepLinkOf({ request })?.depth ?? 1;
