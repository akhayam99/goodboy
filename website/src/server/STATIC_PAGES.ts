import { SITE } from '../site';
import type { PageMeta } from './PageMeta';

export const STATIC_PAGES = {
  home: {
    path: '/',
    title: 'Goodboy: AI coding agent orchestrator for Claude Code, Codex and Cursor',
    description:
      'Goodboy is a free desktop app that runs Claude Code, Codex, Cursor and Gemini on one task, with git worktrees, shared context and review. macOS and Linux.',
    ogType: 'website',
    isIndexed: true,
  },
  features: {
    path: SITE.features,
    title: 'Goodboy features: workflows, git worktrees and review for coding agents',
    description:
      'Everything Goodboy does: workflows that split a goal into agent steps, a git worktree per branch, shared context, a stage board, review and spend limits.',
    ogType: 'website',
    isIndexed: true,
  },
} as const satisfies Record<string, PageMeta>;
