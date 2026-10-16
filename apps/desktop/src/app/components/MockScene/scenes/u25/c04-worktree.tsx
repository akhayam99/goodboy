import { WorktreeScene, type WorktreeSceneConfig } from './c04WorktreeScene';

const SESSION_ROWS: WorktreeSceneConfig = {
  variant: 'github',
  level: 'session',
  gitState: 'behind',
  hasMoreProjects: true,
};
const PR_BEHIND: WorktreeSceneConfig = {
  variant: 'merge-blocked',
  level: 'worktree',
  tab: 'pr',
  gitState: 'behind',
};
const PR_DRAFT: WorktreeSceneConfig = { variant: 'draft', level: 'worktree', tab: 'pr' };
const NO_PR: WorktreeSceneConfig = { variant: 'none', level: 'worktree', tab: 'pr' };
const FILES: WorktreeSceneConfig = { variant: 'github', level: 'worktree', tab: 'files' };
const COMMENTS: WorktreeSceneConfig = { variant: 'github', level: 'worktree', tab: 'comments' };
const CHECKS: WorktreeSceneConfig = { variant: 'merge-blocked', level: 'worktree', tab: 'checks' };
const REBASING: WorktreeSceneConfig = {
  variant: 'github',
  level: 'worktree',
  tab: 'pr',
  gitState: 'rebasing',
};
const MENU: WorktreeSceneConfig = {
  variant: 'github',
  level: 'worktree',
  tab: 'pr',
  isMenuOpen: true,
};
const FOLDED: WorktreeSceneConfig = {
  variant: 'github',
  level: 'worktree',
  tab: 'files',
  isFolded: true,
};

export const U25_C04_WORKTREE_SCENES = {
  'c04-session-worktrees': () => <WorktreeScene config={SESSION_ROWS} />,
  'c04-worktree-pr-behind': () => <WorktreeScene config={PR_BEHIND} />,
  'c04-worktree-pr-draft': () => <WorktreeScene config={PR_DRAFT} />,
  'c04-worktree-no-pr': () => <WorktreeScene config={NO_PR} />,
  'c04-worktree-files': () => <WorktreeScene config={FILES} />,
  'c04-worktree-comments': () => <WorktreeScene config={COMMENTS} />,
  'c04-worktree-checks': () => <WorktreeScene config={CHECKS} />,
  'c04-worktree-rebasing': () => <WorktreeScene config={REBASING} />,
  'c04-worktree-menu': () => <WorktreeScene config={MENU} />,
  'c04-worktree-folded': () => <WorktreeScene config={FOLDED} />,
};
