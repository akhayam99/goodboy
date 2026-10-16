import type { ComponentType } from 'react';
import { C09OrchestratedScene } from './C09OrchestratedScene';

export const U25_C09_ORCHESTRATED_SCENES = {
  'c09-orchestrated-list': () => <C09OrchestratedScene state="running" page="list" />,
  'c09-orchestrated-empty': () => <C09OrchestratedScene state="running" page="empty" />,
  'c09-orch-running': () => <C09OrchestratedScene state="running" page="document" />,
  'c09-orch-step': () => <C09OrchestratedScene state="running" page="step" />,
  'c09-orch-reading': () => <C09OrchestratedScene state="reading" page="document" />,
  'c09-orch-ready': () => <C09OrchestratedScene state="ready" page="document" />,
  'c09-orch-failed': () => <C09OrchestratedScene state="failed" page="document" />,
  'c09-orch-done': () => <C09OrchestratedScene state="done" page="document" />,
  'c09-orch-archived': () => <C09OrchestratedScene state="archived" page="document" />,
  'c09-orch-menu': () => <C09OrchestratedScene state="running" page="document" click="menu" />,
  'c09-orch-guidance': () => (
    <C09OrchestratedScene state="running" page="document" click="guidance" />
  ),
  'c09-orch-guidance-once': () => (
    <C09OrchestratedScene state="running" page="document" click="guidance" isGuidanceRepeated />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
