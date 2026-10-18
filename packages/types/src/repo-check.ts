export type GitRepoErrorKind =
  'not_found' | 'permission_denied' | 'not_a_directory' | 'not_a_repository' | 'git_failed';

export type GitRepoCheck = Readonly<{
  isRepo: boolean;
  rootPath: string | null;
  resolvedPath: string | null;
  defaultBranch: string | null;
  error: string | null;
  errorKind: GitRepoErrorKind | null;
}>;

export type ChildRepo = Readonly<{
  name: string;
  path: string;
  defaultBranch: string | null;
}>;
