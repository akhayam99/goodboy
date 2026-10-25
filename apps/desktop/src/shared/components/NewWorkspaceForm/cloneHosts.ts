import type { CloneHostKey } from '../../lib/repoClone/repoCloneTypes';

export type CloneHostOption = {
  readonly key: CloneHostKey;
  readonly label: string;
  readonly domain: string;
};

export const CLONE_HOSTS: ReadonlyArray<CloneHostOption> = [
  { key: 'github', label: 'GitHub', domain: 'github.com' },
  { key: 'gitlab', label: 'GitLab', domain: 'gitlab.com' },
  { key: 'bitbucket', label: 'Bitbucket', domain: 'bitbucket.org' },
];
