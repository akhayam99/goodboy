export const PROJECTS_HINT_DISMISSED_KEY = 'projects.hint.dismissed';

export const PROJECTS_EXPLAINER = 'Where this session works. Each branch gets its own worktree.';

type ShowParams = {
  readonly settings: Readonly<Record<string, string>> | undefined;
  readonly worktreeCount: number;
};

export const shouldShowProjectsHint = ({ settings, worktreeCount }: ShowParams): boolean =>
  worktreeCount > 0 && (settings ?? {})[PROJECTS_HINT_DISMISSED_KEY] !== 'true';

type DismissParams = {
  readonly settings: Readonly<Record<string, string>> | undefined;
  readonly worktreeCount: number;
};

export const shouldDismissProjectsHint = ({ settings, worktreeCount }: DismissParams): boolean =>
  worktreeCount > 1 && (settings ?? {})[PROJECTS_HINT_DISMISSED_KEY] !== 'true';
