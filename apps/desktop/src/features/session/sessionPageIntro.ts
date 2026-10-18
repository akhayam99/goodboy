import type { Page } from './pageRegistry';

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
    'Auto now picks the role for you. Agents you start by hand keep working.',
  ],
  auto: [
    'Auto takes over from Agents. It reads your request and starts the right agent.',
    'Or it answers itself, under a limit. Its choices are still being tuned.',
  ],
} as const satisfies Readonly<Record<IntroPage, IntroLines>>;
