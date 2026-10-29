import type { ComponentType } from 'react';
import { StartRunScene } from './StartRunScene';

const ASK = 'Which handler in notify-relay fires the duplicate credit twice?';

const PLAN_ASK = 'Center every billing page in payments-api';

export const U28_START_RUN_SCENES: Readonly<Record<string, ComponentType>> = {
  'u28-start-run-route-line': () => <StartRunScene text={ASK} openLabels={[]} />,
  'u28-start-run-run-as-menu': () => <StartRunScene text={ASK} openLabels={['Run as']} />,
  'u28-start-run-model-menu': () => <StartRunScene text={ASK} openLabels={['Model']} />,
  'u28-start-run-orchestrated': () => <StartRunScene text={PLAN_ASK} openLabels={[]} />,
  'u28-start-run-no-limit': () => <StartRunScene text="" openLabels={['No limit']} />,
};
