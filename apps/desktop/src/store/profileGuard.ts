import type { WorkspaceProfile } from '@goodboy/types';

type GuardParams = {
  readonly profile: WorkspaceProfile | undefined;
};

const identitySentence = ({ profile }: GuardParams): string => {
  const parts: string[] = [];
  if (profile?.role != null) {
    parts.push(`role: ${profile.role}`);
  }
  if (profile?.discipline != null && profile.discipline.length > 0) {
    parts.push(`discipline: ${profile.discipline}`);
  }
  if (profile !== undefined && profile.topics.length > 0) {
    parts.push(`topics: ${profile.topics.join(', ')}`);
  }
  return parts.join('; ');
};

export const buildProfileGuard = ({ profile }: GuardParams): string => {
  if (profile === undefined) {
    return '';
  }
  const identity = identitySentence({ profile });
  const notes = profile.notes?.trim() ?? '';
  if (identity.length === 0 && notes.length === 0) {
    return '';
  }
  const lines = ['[user-profile]'];
  if (identity.length > 0) {
    lines.push(`The person you are working with: ${identity}.`);
  }
  if (notes.length > 0) {
    lines.push(`Notes from them: ${notes}`);
  }
  if (profile.role === 'non-developer') {
    lines.push(
      'They do not write code. Do not show raw diffs, patches, or code blocks unless they ask; explain changes as outcomes and user-visible behavior.',
    );
  }
  if (profile.discipline === 'platform') {
    lines.push(
      'They think across projects: cross-project reasoning and connections between repos are welcome.',
    );
  }
  lines.push('[/user-profile]');
  return lines.join('\n');
};
