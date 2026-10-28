import type { ComponentType } from 'react';
import { StartRunScene } from './StartRunScene';

const ASK = 'Which handler in notify-relay fires the duplicate credit twice?';

export const U28_START_RUN_SCENES: Readonly<Record<string, ComponentType>> = {
  'u28-start-run-route-line': () => <StartRunScene text={ASK} openLabels={[]} />,
  'u28-start-run-run-as-menu': () => <StartRunScene text={ASK} openLabels={['Run as']} />,
  'u28-start-run-no-limit': () => <StartRunScene text="" openLabels={['No limit']} />,
};
