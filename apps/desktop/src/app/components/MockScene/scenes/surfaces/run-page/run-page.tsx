import type { ComponentType } from 'react';
import { RunPageScene } from './RunPageScene';

export const RUN_PAGE_SCENES = {
  'run-page-plan': () => <RunPageScene state="plan" theme="dark" />,
  'run-page-plan-light': () => <RunPageScene state="plan" theme="light" />,
  'run-page-working': () => <RunPageScene state="working" theme="dark" />,
  'run-page-done': () => <RunPageScene state="done" theme="dark" />,
  'run-page-done-light': () => <RunPageScene state="done" theme="light" />,
  'run-page-many': () => <RunPageScene state="deliveredTwo" theme="dark" />,
} satisfies Readonly<Record<string, ComponentType>>;
