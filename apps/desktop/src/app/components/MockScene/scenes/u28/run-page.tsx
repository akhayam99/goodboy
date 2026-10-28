import type { ComponentType } from 'react';
import { C09OrchestratedScene } from '../u25/C09OrchestratedScene';

export const U28_RUN_PAGE_SCENES = {
  'u28-run-step-blocked': () => <C09OrchestratedScene state="step-blocked" page="document" />,
  'u28-run-orch-blocked': () => <C09OrchestratedScene state="blocked" page="document" />,
  'u28-run-kind-live': () => (
    <C09OrchestratedScene state="running" page="document" click="kind" isRouted />
  ),
  'u28-run-kind-ended': () => (
    <C09OrchestratedScene state="failed" page="document" click="kind" isRouted />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
