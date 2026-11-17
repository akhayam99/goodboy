import type { LeadPermissionKey } from '@goodboy/core/auto';

export type PermissionGroup = Readonly<{
  title: string;
  keys: ReadonlyArray<LeadPermissionKey>;
}>;

export const PERMISSION_GROUPS: ReadonlyArray<PermissionGroup> = [
  { title: 'Agents', keys: ['approvePlan', 'startReaders', 'startWriters'] },
  { title: 'Git and publishing', keys: ['push', 'pullRequest'] },
  { title: 'Project', keys: ['dependencies', 'protectedFiles', 'addProject', 'closeWork'] },
];
