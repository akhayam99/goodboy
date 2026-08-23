import type { WorkspaceProfile } from '@goodboy/types';

type GuardParams = {
  readonly profile: WorkspaceProfile | undefined;
};

export const buildProfileGuard = ({ profile }: GuardParams): string => {
  const bio = profile?.bio?.trim() ?? '';
  if (bio === '') {
    return '';
  }
  return ['[user-profile]', 'The person you are working with says:', bio, '[/user-profile]'].join(
    '\n',
  );
};
