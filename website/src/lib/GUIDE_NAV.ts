import type { SITE } from './site';

export const GUIDE_NAV = {
  worktrees: 'Git worktrees',
  parallel: 'Parallel agents',
  review: 'Fix PR comments',
  handoff: 'Context handoff',
  costs: 'Control costs',
  together: 'Use agents together',
  multiRepo: 'Multi-repo changes',
  glossary: 'Glossary',
} as const satisfies Record<keyof typeof SITE.guides, string>;
