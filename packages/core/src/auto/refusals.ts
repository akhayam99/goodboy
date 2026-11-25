export const AUTO_REFUSAL_CODES = [
  'request_conflict',
  'depth_cap',
  'substep_cap',
  'empty_batch',
  'budget',
  'already_yielded',
  'not_deciding',
  'tree_stopped',
  'generation_changed',
  'not_owner',
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
  'mount_elsewhere',
  'delegation_unknown',
  'question_unknown',
  'not_paused',
  'no_run',
  'retry_unavailable',
  'role_lacks_shell',
  'role_narrower',
  'return_limit',
  'task_rebrief_limit',
  'not_returned',
  'message_limit',
  'not_running',
  'check_pending',
  'held',
] as const;

export type AutoRefusalCode = (typeof AUTO_REFUSAL_CODES)[number];

export const AUTO_MOUNTED_CODE = 'mounted';

type MountedCodeParams = {
  readonly code: string;
};

export const isAutoMountedCode = ({ code }: MountedCodeParams): boolean =>
  code === AUTO_MOUNTED_CODE;
