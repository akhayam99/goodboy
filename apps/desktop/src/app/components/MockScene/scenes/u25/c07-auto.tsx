import type { ComponentType } from 'react';
import { C07AutoFrame } from './c07/C07AutoFrame';
import type { C07Seed } from './c07/c07AutoSeed';

const WORKING: C07Seed = { state: 'working', place: 'auto' };
const IDLE: C07Seed = { state: 'done', place: 'auto' };
const PLAN: C07Seed = { state: 'plan', place: 'auto' };
const ANSWERING: C07Seed = { state: 'answering', place: 'auto' };
const SESSION: C07Seed = { state: 'working', place: 'session' };
const LIST: C07Seed = { state: 'done', place: 'list' };
const START: C07Seed = { state: 'working', place: 'start' };
const PROJECT: C07Seed = { state: 'refused', place: 'auto' };
const CHILD: C07Seed = { state: 'working', place: 'auto', pane: 'implementer' };
const CHILD_DONE: C07Seed = { state: 'done', place: 'auto', pane: 'tester' };
const CAPPED: C07Seed = { state: 'working', place: 'auto', isCapped: true };
const LIMIT_CLICKS: ReadonlyArray<string> = ['Limit $'];
const BLOCKED: C07Seed = { state: 'blocked', place: 'auto' };
const STOP_CLICKS: ReadonlyArray<string> = ['Stop Auto and its agents'];
const IMAGES: C07Seed = { state: 'working', place: 'auto', pane: 'implementer', hasImages: true };

export const U25_C07_AUTO_SCENES = {
  'c07-auto-working': () => <C07AutoFrame seed={WORKING} />,
  'c07-auto-idle': () => <C07AutoFrame seed={IDLE} />,
  'c07-auto-plan': () => <C07AutoFrame seed={PLAN} />,
  'c07-auto-answering': () => <C07AutoFrame seed={ANSWERING} />,
  'c07-auto-session-level': () => <C07AutoFrame seed={SESSION} />,
  'c07-auto-list': () => <C07AutoFrame seed={LIST} />,
  'c07-auto-start': () => <C07AutoFrame seed={START} />,
  'c07-auto-folded': () => <C07AutoFrame seed={WORKING} isFolded />,
  'c07-auto-project': () => <C07AutoFrame seed={PROJECT} />,
  'c07-auto-child': () => <C07AutoFrame seed={CHILD} />,
  'c07-auto-child-done': () => <C07AutoFrame seed={CHILD_DONE} />,
  'c07-auto-images': () => <C07AutoFrame seed={IMAGES} />,
  'c07-auto-capped': () => <C07AutoFrame seed={CAPPED} />,
  'c07-auto-limit-popover': () => <C07AutoFrame seed={WORKING} clicks={LIMIT_CLICKS} />,
  'c07-auto-blocked': () => <C07AutoFrame seed={BLOCKED} />,
  'c07-auto-stop-failed': () => <C07AutoFrame seed={WORKING} clicks={STOP_CLICKS} />,
} satisfies Readonly<Record<string, ComponentType>>;
