import type { ComponentType } from 'react';
import { P9AgentAskScene } from './P9AgentAskScene';
import { P9AlwaysStoppedScene } from './P9AlwaysStoppedScene';
import { C06AgentScene } from '../u25/C06AgentScene';
import { C07AutoFrame } from '../u25/c07/C07AutoFrame';
import { P9AutoAsksScene } from './P9AutoAsksScene';

const TYPED = 'Use pnpm store prune, keep node_modules.';

export const U36_P9_DOCK_SCENES = {
  'u36-p9-permission': () => <P9AgentAskScene state="permission" />,
  'u36-p9-permission-typed': () => <P9AgentAskScene state="permission" draft={TYPED} />,
  'u36-p9-always-stopped': () => <P9AlwaysStoppedScene />,
  'u36-p9-question': () => <P9AgentAskScene state="finished" hasQuestions />,
  'u36-p9-auto-asks': () => <P9AutoAsksScene />,
  'u36-p9-running': () => <C06AgentScene state="working" />,
  'u36-p9-failed': () => <C06AgentScene state="failed" />,
  'u36-p9-stopped': () => <C06AgentScene state="stopped" />,
  'u36-p9-auto-running': () => <C07AutoFrame seed={{ state: 'working', place: 'auto' }} />,
  'u36-p9-auto-limit': () => (
    <C07AutoFrame seed={{ state: 'working', place: 'auto', isCapped: true }} />
  ),
  'u36-p9-auto-failed': () => <C07AutoFrame seed={{ state: 'blocked', place: 'auto' }} />,
  'u36-p9-auto-project': () => <C07AutoFrame seed={{ state: 'refused', place: 'auto' }} />,
  'u36-p9-auto-next': () => <C07AutoFrame seed={{ state: 'confirm', place: 'auto' }} />,
} satisfies Readonly<Record<string, ComponentType>>;
