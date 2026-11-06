import type { ComponentType } from 'react';
import { P9AgentAskScene } from './P9AgentAskScene';
import { P9AutoAsksScene } from './P9AutoAsksScene';

const TYPED = 'Use pnpm store prune, keep node_modules.';

export const U36_P9_DOCK_SCENES = {
  'u36-p9-permission': () => <P9AgentAskScene state="permission" />,
  'u36-p9-permission-typed': () => <P9AgentAskScene state="permission" draft={TYPED} />,
  'u36-p9-question': () => <P9AgentAskScene state="finished" hasQuestions />,
  'u36-p9-auto-asks': () => <P9AutoAsksScene />,
} satisfies Readonly<Record<string, ComponentType>>;
