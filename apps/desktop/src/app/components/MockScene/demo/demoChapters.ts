import type { DemoHint } from './hints/demoHintTypes';
import { ONBOARDING_HINTS } from './hints/onboardingHints';
import { AGENT_HINTS } from './hints/agentHints';

export type DemoBeat = {
  readonly label: string;
  readonly scene: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly holdMs: number;
};

export type DemoChapter = {
  readonly id: string;
  readonly title: string;
  readonly isOptional?: boolean;
  readonly summary: string;
  readonly tryThis: string;
  readonly hints?: ReadonlyArray<DemoHint>;
  readonly beats: ReadonlyArray<DemoBeat>;
};

export const DEMO_CHAPTERS: readonly [DemoChapter, ...ReadonlyArray<DemoChapter>] = [
  {
    id: 'setup',
    title: 'Set up',
    isOptional: true,
    summary:
      'Goodboy finds the agents on your Mac, then you point it at your code and hand over a first task.',
    tryThis: 'Press Get started and walk the setup yourself.',
    hints: ONBOARDING_HINTS,
    beats: [
      { label: 'Welcome', scene: 'onboarding', params: { step: 'welcome' }, holdMs: 5000 },
      { label: 'Agents', scene: 'onboarding', params: { step: 'agents' }, holdMs: 5000 },
      { label: 'Workspace', scene: 'onboarding', params: { step: 'workspace' }, holdMs: 5000 },
      { label: 'Tools', scene: 'onboarding', params: { step: 'tools' }, holdMs: 5000 },
      {
        label: 'First task',
        scene: 'onboarding',
        params: { step: 'first-session' },
        holdMs: 6000,
      },
    ],
  },
  {
    id: 'agent',
    title: 'Work with an agent',
    summary:
      'Send a follow-up, answer the question the agent stops on and keep an eye on your limits.',
    tryThis: 'Send the message, then answer the blocking question.',
    hints: AGENT_HINTS,
    beats: [
      { label: 'Works, then asks', scene: 'chat-shell', holdMs: 4000 },
      { label: 'Limits', scene: 'brand-limits', holdMs: 6000 },
    ],
  },
  {
    id: 'orchestrate',
    title: 'Orchestrate',
    summary:
      'Let Auto plan and delegate, or run a saved workflow that stops when a step needs you.',
    tryThis: 'Read the plan, then follow a helper agent.',
    beats: [
      { label: 'Auto starts', scene: 'c07-auto-start', holdMs: 4000 },
      { label: 'Auto plans', scene: 'c07-auto-plan', holdMs: 5000 },
      { label: 'Auto works', scene: 'c07-auto-working', holdMs: 5000 },
      { label: 'Helper done', scene: 'c07-auto-child-done', holdMs: 5000 },
      { label: 'Run approval', scene: 'c08-run-approval', holdMs: 4500 },
      { label: 'Run steps', scene: 'c08-run-working', holdMs: 2500 },
      { label: 'Run done', scene: 'c08-run-done', holdMs: 5000 },
    ],
  },
  {
    id: 'find',
    title: 'Find work and results',
    summary:
      'Every session on one board, grouped by what needs you, and every report next to its code.',
    tryThis: 'Open the card that needs you, then a report from the library.',
    beats: [
      { label: 'Board', scene: 'board-shell', holdMs: 4000 },
      { label: 'Library', scene: 'artifacts-lens-shell', holdMs: 5000 },
      { label: 'Report', scene: 'artifact-report', holdMs: 5000 },
    ],
  },
  {
    id: 'review',
    title: 'Review and ship',
    summary: 'Read every change before it is pushed, and turn review comments into fixes.',
    tryThis: 'Switch between files, then pick a comment and start a fix.',
    beats: [
      { label: 'Diff', scene: 'brand-diff', holdMs: 6000 },
      { label: 'Comments', scene: 'resolve-queue-shell', holdMs: 5000 },
      { label: 'Fixing', scene: 'resolve-fix-working', holdMs: 5000 },
      { label: 'Ready', scene: 'resolve-fix-ready', holdMs: 5000 },
    ],
  },
];
