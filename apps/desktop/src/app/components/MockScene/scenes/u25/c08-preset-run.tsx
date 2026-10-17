import type { ComponentType } from 'react';
import { C08RunScene } from './C08RunScene';

export const U25_C08_PRESET_RUN_SCENES = {
  'c08-runs': () => <C08RunScene state="working" selection="list" />,
  'c08-run-working': () => <C08RunScene state="working" selection="implementer" />,
  'c08-run-working-other': () => <C08RunScene state="working" selection="scout" />,
  'c08-run-overview': () => <C08RunScene state="working" selection="overview" />,
  'c08-run-ready': () => <C08RunScene state="ready" selection="implementer" />,
  'c08-run-approval': () => <C08RunScene state="approval" selection="scout" />,
  'c08-run-capped': () => <C08RunScene state="capped" selection="implementer" />,
  'c08-run-done': () => <C08RunScene state="done" selection="overview" />,
  'c08-run-archived': () => <C08RunScene state="archived" selection="overview" />,
  'c08-run-menu': () => <C08RunScene state="working" selection="implementer" click="menu" />,
  'c08-run-add-step': () => <C08RunScene state="done" selection="overview" click="addStep" />,
  'c08-run-folded': () => <C08RunScene state="working" selection="implementer" isFolded />,
} satisfies Readonly<Record<string, ComponentType>>;
