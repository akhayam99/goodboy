import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppFooter } from '../../AppFooter';
import type { FooterTarget } from '../../../hooks/useAppOverlays/overlayState';
import { AppTopBar } from '../../AppTopBar';
import { ToastProvider } from '../../Toast';
import { shellArrangement } from '../../../shellArrangement';

const noop = () => undefined;

type StudioFrameProps = {
  readonly target: FooterTarget;
  readonly main: ReactNode;
};

export const StudioFrame = ({ target, main }: StudioFrameProps) => {
  const arrangement = shellArrangement({
    hasWorkspace: true,
    hasActiveSession: false,
    isSidebarCollapsed: false,
  });

  return (
    <ToastProvider>
      <AppShell
        topBar={<AppTopBar onOpenSpend={noop} />}
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={undefined}
        footer={
          <AppFooter
            scope={arrangement.footer}
            target={target}
            connected={{
              github: true,
              linear: true,
              jira: true,
              sentry: true,
              gitlab: false,
              bitbucket: false,
              slack: true,
            }}
            onOpenIntegration={noop}
            onOpenInbox={noop}
            onOpenWorkflows={noop}
            onOpenProviders={noop}
            onOpenSettings={noop}
            onOpenImpact={noop}
            onOpenChangelog={noop}
          />
        }
        main={main}
      />
    </ToastProvider>
  );
};
