import { SITE } from '../site';
import type { PageMeta } from './PageMeta';
import { RELEASES } from './RELEASES';

const HOME = { name: 'Home', path: '/' };
const LATEST_DATE = RELEASES[0]?.date ?? '';

export const STATIC_PAGES = {
  home: {
    path: '/',
    title: 'Goodboy: AI coding agent orchestrator for Claude Code, Codex and Cursor',
    description:
      'Goodboy is a free desktop app that runs Claude Code, Codex, Cursor and Gemini on one task, with git worktrees, shared context and review. macOS and Linux.',
    ogType: 'website',
    pageType: 'WebPage',
    crumbs: [HOME],
    lastmod: LATEST_DATE,
    isIndexed: true,
  },
  features: {
    path: SITE.features,
    title: 'Goodboy features: workflows, git worktrees and review for coding agents',
    description:
      'Everything Goodboy does: workflows that split a goal into agent steps, a git worktree per branch, shared context, a stage board, review and spend limits.',
    ogType: 'website',
    pageType: 'WebPage',
    crumbs: [HOME, { name: 'Features', path: SITE.features }],
    lastmod: LATEST_DATE,
    isIndexed: true,
  },
  notFound: {
    path: '/404',
    title: 'Page not found | Goodboy',
    description: "This page isn't on goodboy-ai.dev. The home page, the features and the docs are.",
    ogType: 'website',
    pageType: 'WebPage',
    crumbs: [],
    lastmod: LATEST_DATE,
    isIndexed: false,
  },
} as const satisfies Record<string, PageMeta>;
