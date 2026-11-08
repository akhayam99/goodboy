import { SITE } from '../lib/site';
import type { PageMeta } from './PageMeta';

const HOME = { name: 'Home', path: '/' };

export const STATIC_PAGES = {
  home: {
    path: '/',
    title: 'Goodboy: the agentic development environment for your coding agents',
    description:
      'Goodboy is a free agentic development environment (ADE) for Claude Code, Codex, Cursor, Gemini and Copilot: git worktrees, shared context and review. macOS, Linux.',
    ogType: 'website',
    kind: 'home',
    crumbs: [HOME],
    isIndexed: true,
  },
  features: {
    path: SITE.features,
    title: 'Goodboy features: workflows, git worktrees and review for coding agents',
    description:
      'Everything Goodboy does: workflows that split a goal into agent steps, a git worktree per branch, shared context, a stage board, review and spend limits.',
    ogType: 'website',
    kind: 'features',
    crumbs: [HOME, { name: 'Features', path: SITE.features }],
    isIndexed: true,
  },
  notFound: {
    path: '/404',
    title: 'Page not found | Goodboy',
    description: "This page isn't on goodboy-ai.dev. The home page, the features and the docs are.",
    ogType: 'website',
    kind: 'not-found',
    crumbs: [],
    isIndexed: false,
  },
} as const satisfies Record<string, PageMeta>;
