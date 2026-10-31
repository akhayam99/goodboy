import type { Page } from './pageRegistry';

type IntroPage = Extract<Page['id'], 'runs'>;

type IntroLines = readonly [string];

export const SESSION_PAGE_INTRO = {
  runs: ['Every run in this session. Open one to follow, answer or steer it.'],
} as const satisfies Readonly<Record<IntroPage, IntroLines>>;
