import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { AnalyzeFixScene } from '../u24/AnalyzeFixScene';
import type { AnalyzeFixPhase } from '../u24/analyzeFixSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly phase: AnalyzeFixPhase;
};

export const AfterAnalyzeScene = ({ theme, phase }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return <AnalyzeFixScene phase={phase} surface="activity" />;
};
