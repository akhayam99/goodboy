import type { ReactNode } from 'react';
import { ErrorBoundary, type ErrorFallbackRequest } from '@goodboy/ui';
import { logRenderCrash } from '../../../features/bug-report/logRenderCrash';
import { PanelFallback } from './PanelFallback';

type Props = {
  readonly children: ReactNode;
  readonly leaveLabel: string;
  readonly onLeave: () => void;
};

export const PanelBoundary = ({ children, leaveLabel, onLeave }: Props) => (
  <ErrorBoundary
    onCatch={logRenderCrash}
    renderFallback={(request: ErrorFallbackRequest) => (
      <PanelFallback {...request} leaveLabel={leaveLabel} onLeave={onLeave} />
    )}
  >
    {children}
  </ErrorBoundary>
);
