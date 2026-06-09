export type BranchCommit = {
  readonly sha: string;
  readonly shortSha: string;
  readonly subject: string;
  readonly author: string;
  readonly timestamp: number;
  readonly pushed: boolean;
  readonly parentSha: string | null;
};

export type WorktreeStatus = {
  readonly branch: string | null;
  readonly head: string | null;
  readonly headSubject: string | null;
  readonly ahead: number;
  readonly behind: number;
  readonly staged: number;
  readonly unstaged: number;
  readonly untracked: number;
  readonly changed: number;
  readonly hasUpstream: boolean;
};

export type WorktreeDiffScope = 'unstaged' | 'staged' | 'all';

export type DiffView =
  | { readonly kind: 'working'; readonly scope: WorktreeDiffScope }
  | { readonly kind: 'commit'; readonly sha: string }
  | { readonly kind: 'branch' };
