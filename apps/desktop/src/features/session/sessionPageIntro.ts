import type { Page } from './pageRegistry';

const HAND_STARTED_KEEP_RUNNING = 'Agents you start by hand keep running.';

const AUTO_STILL_TUNED = 'Its choices are still being tuned.';

type IntroPage = Extract<Page['id'], 'runs' | 'orchestrated' | 'agents' | 'auto'>;

type IntroLines = readonly [string, string];

export const SESSION_PAGE_INTRO = {
  runs: [
    'Runs a workflow you or Goodboy saved: the same steps, in order, every time.',
    'Each step has its agent. The run stops for you where the workflow says.',
  ],
  orchestrated: [
    'You give a goal, and the orchestrator plans the whole run from it.',
    "It picks each next step and its agent, and asks you when it's unsure.",
  ],
  agents: [
    "Runs one agent in the role you pick, until it's done or needs you.",
    `Auto now picks the role for you. ${HAND_STARTED_KEEP_RUNNING}`,
  ],
  auto: [
    'Auto takes over from Agents. It reads your request and starts the right agent.',
    `Or it answers itself, under a limit. ${AUTO_STILL_TUNED}`,
  ],
} as const satisfies Readonly<Record<IntroPage, IntroLines>>;

export const SESSION_PAGE_MARKER_WHY = {
  auto: `Auto starts agents on its own. ${AUTO_STILL_TUNED}`,
} as const;
