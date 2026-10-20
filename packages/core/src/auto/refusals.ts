export const AUTO_REFUSAL_CODES = [
  'request_conflict',
  'depth_cap',
  'substep_cap',
  'breadth_cap',
  'empty_batch',
  'budget',
  'already_yielded',
  'not_deciding',
  'tree_stopped',
  'generation_changed',
  'not_owner',
  'limit_calls',
  'limit_refusals',
  'limit_wall_clock',
  'artifact_unknown',
  'stale_revision',
  'artifact_consumed',
  'artifact_discarded',
  'artifact_busy',
  'artifact_revising',
  'artifact_unapproved',
  'role_mismatch',
  'tree_busy',
  'spec_invalid',
  'role_unknown',
  'no_provider',
  'provider_unproven',
  'mount_missing',
  'mount_ambiguous',
  'delegation_unknown',
  'question_unknown',
  'not_paused',
  'no_run',
  'retry_unavailable',
  'role_lacks_shell',
] as const;

export type AutoRefusalCode = (typeof AUTO_REFUSAL_CODES)[number];

export const AUTO_LIMIT_REFUSAL_CODES = [
  'limit_calls',
  'limit_refusals',
  'limit_wall_clock',
] as const satisfies ReadonlyArray<AutoRefusalCode>;

type RefusalCodeParams = {
  readonly code: AutoRefusalCode;
};

export const isAutoLimitRefusal = ({ code }: RefusalCodeParams): boolean =>
  AUTO_LIMIT_REFUSAL_CODES.some((candidate) => candidate === code);
