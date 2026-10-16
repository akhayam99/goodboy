import type { ComponentType } from 'react';
import { AnalyzeFixScene } from './AnalyzeFixScene';

export const U24_ANALYZE_FIX_SCENES: Readonly<Record<string, ComponentType>> = {
  'checks-proposal': () => <AnalyzeFixScene phase="proposal" surface="checks" />,
  'checks-fixing': () => <AnalyzeFixScene phase="fixing" surface="checks" />,
  'activity-check-chain': () => <AnalyzeFixScene phase="fixing" surface="activity" />,
  'activity-ci-fix-unloaded': () => (
    <AnalyzeFixScene phase="fixing" surface="timeline" isDetailUnloaded />
  ),
};
