import type { Page } from './pageRegistry';

type IntroPage = Extract<Page['id'], 'runs'>;

type IntroLines = readonly [string, string];

export const SESSION_PAGE_INTRO = {
  runs: [
    'Every run in this session: plans, presets, Auto and your agents.',
    'Open one to follow it, answer it or steer it.',
  ],
} as const satisfies Readonly<Record<IntroPage, IntroLines>>;
