import type { LeadPermissionKey } from '@goodboy/core/auto';

export type PermissionGroup = Readonly<{
  title: string;
  keys: ReadonlyArray<LeadPermissionKey>;
  hasLimit: boolean;
}>;

export const PERMISSION_GROUPS: ReadonlyArray<PermissionGroup> = [
  { title: 'Agents', keys: ['approvePlan', 'startReaders', 'startWriters'], hasLimit: false },
  { title: 'Git and publishing', keys: ['push', 'pullRequest'], hasLimit: false },
  { title: 'Project', keys: ['dependencies', 'protectedFiles', 'addProject'], hasLimit: false },
  { title: 'Finish', keys: ['closeWork'], hasLimit: true },
];
