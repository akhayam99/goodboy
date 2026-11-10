import type { ComponentType } from 'react';
import { P9SlotScene } from './P9SlotScene';

export const U39_P9_SCENES = {
  'ux39-p9-session-drawer': () => <P9SlotScene view="session" />,
  'ux39-p9-tasks-parked': () => <P9SlotScene view="inbox" />,
  'ux39-p9-impact-parked': () => <P9SlotScene view="spend" />,
  'ux39-p9-workflows-parked': () => <P9SlotScene view="workflows" />,
} satisfies Readonly<Record<string, ComponentType>>;
