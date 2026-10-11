import type { ComponentType } from 'react';
import { ChecksAnalyzeScene } from './ChecksAnalyzeScene';

export const U24_CHECKS_ANALYZE_SCENES: Readonly<Record<string, ComponentType>> = {
  'branch-checks-analyze-failing': () => <ChecksAnalyzeScene phase="failing" />,
  'branch-checks-analyzing': () => <ChecksAnalyzeScene phase="running" />,
  'branch-checks-analyzed': () => <ChecksAnalyzeScene phase="proposal" />,
  'debugger-drawer-running': () => <ChecksAnalyzeScene phase="running" shouldOpenDrawer />,
  'debugger-drawer-proposal': () => <ChecksAnalyzeScene phase="proposal" shouldOpenDrawer />,
};
