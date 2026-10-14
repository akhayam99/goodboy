import type { ComponentType } from 'react';
import { AnalyzeFixScene } from './AnalyzeFixScene';

export const U24_CI_FIX_STATE_SCENES: Readonly<Record<string, ComponentType>> = {
  'checks-fixed-local': () => <AnalyzeFixScene phase="fixed-local" surface="checks" />,
  'activity-check-fixed-local': () => <AnalyzeFixScene phase="fixed-local" surface="activity" />,
  'debugger-drawer-fixed-local': () => (
    <AnalyzeFixScene phase="fixed-local" surface="checks" shouldOpenDrawer />
  ),
};
