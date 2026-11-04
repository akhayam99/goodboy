import { clippedTextOf } from '@goodboy/types/helpers';

const FIELD_CHARS = 1_000;
const BRANCH_CHARS = 200;
const BRANCH_PATTERN = /^[A-Za-z0-9._/-]+$/;

export type MountSpec = Readonly<{
  project: string;
  branch: string | null;
  reason: string;
}>;

export type MountSpecOutcome =
  Readonly<{ kind: 'ok'; spec: MountSpec }> | Readonly<{ kind: 'invalid'; reason: string }>;

type ParseParams = {
  readonly fields: Readonly<Record<string, unknown>>;
};

type BranchParams = {
  readonly branch: string;
};

export const isNamedBranch = ({ branch }: BranchParams): boolean =>
  branch.length <= BRANCH_CHARS &&
  BRANCH_PATTERN.test(branch) &&
  !branch.startsWith('-') &&
  !branch.startsWith('/') &&
  !branch.endsWith('/') &&
  !branch.endsWith('.') &&
  !branch.includes('..') &&
  !branch.includes('//');

export const parseMountSpec = ({ fields }: ParseParams): MountSpecOutcome => {
  const project = clippedTextOf({ value: fields['project'], max: FIELD_CHARS });
  const reason = clippedTextOf({ value: fields['reason'], max: FIELD_CHARS });
  if (project === null || reason === null) {
    return { kind: 'invalid', reason: 'a mount block needs a "project" and a "reason"' };
  }
  const rawBranch = fields['branch'];
  if (rawBranch === undefined || rawBranch === null) {
    return { kind: 'ok', spec: { project, branch: null, reason } };
  }
  const branch = typeof rawBranch === 'string' ? rawBranch.trim() : '';
  if (!isNamedBranch({ branch })) {
    return { kind: 'invalid', reason: '"branch" must be a valid git branch name' };
  }
  return { kind: 'ok', spec: { project, branch, reason } };
};
