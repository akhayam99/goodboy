import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { SkeletonRows } from '@goodboy/ui';
import type { DrawerRequest } from '../../store/slices/drawer/state';
import { lazyNamed } from '../../shared/lib/lazyNamed';
import { browserDrawerRegistration } from '../../features/browser/browserDrawerRegistration';
import { checkAnalysisDrawerRegistration } from '../../features/branch/checkAnalysisDrawerRegistration';
import { fileDiffDrawerRegistration } from '../../features/diff/fileDiffDrawerRegistration';
import { drawerKey } from '../../store/slices/drawer/drawerKey';
import { historyVersionsDrawerRegistration } from '../../features/history/historyVersionsDrawerRegistration';
import { leadDetailsDrawerRegistration } from '../../features/auto/permissions/leadDetailsDrawerRegistration';
import { monitoringDrawerRegistration } from '../../features/monitoring/monitoringDrawerRegistration';
import { planPartDrawerRegistration } from '../../features/plans/planPartDrawerRegistration';
import { terminalDrawerRegistration } from '../../features/terminal/terminalDrawerRegistration';
import { askDrawerRegistration } from '../../features/session/ask/askDrawerRegistration';
import { scriptsDrawerRegistration } from '../../features/scripts/scriptsDrawerRegistration';
import { DeskPr } from '../../features/branch/components/DeskPr';
import { renderPrChecks } from './renderPrChecks';

const IdentifierPeekSource = lazyNamed({
  load: () => import('./IdentifierPeekSource'),
  pick: ({ IdentifierPeekSource }) => IdentifierPeekSource,
});

const IdentifierPeekDrawer = lazyNamed({
  load: () => import('../../features/diff/components/IdentifierPeekDrawer'),
  pick: ({ IdentifierPeekDrawer }) => IdentifierPeekDrawer,
});

type RegisteredDrawer = Extract<
  DrawerRequest,
  {
    readonly kind:
      | 'ask'
      | 'browser'
      | 'check-analysis'
      | 'file-diff'
      | 'history-versions'
      | 'identifier-peek'
      | 'lead-details'
      | 'monitoring'
      | 'plan-part'
      | 'pull-request'
      | 'scripts'
      | 'terminal';
  }
>;

type RenderParams = {
  readonly drawer: RegisteredDrawer;
  readonly closeDrawer: () => void;
  readonly openDrawer: (request: DrawerRequest) => void;
};

export const renderRegisteredDrawer = ({
  drawer,
  closeDrawer,
  openDrawer,
}: RenderParams): ReactNode => {
  switch (drawer.kind) {
    case 'ask':
      return askDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    case 'browser':
      return browserDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    case 'check-analysis':
      return checkAnalysisDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    case 'file-diff':
      return fileDiffDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    case 'history-versions':
      return historyVersionsDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    case 'identifier-peek':
      return (
        <Suspense
          key={drawerKey(drawer)}
          fallback={
            <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
              Opening the search
            </p>
          }
        >
          <IdentifierPeekDrawer
            sessionId={drawer.sessionId}
            worktreePath={drawer.payload.worktreePath}
            word={drawer.payload.word}
            selected={drawer.payload.selected}
            renderSource={({ worktreePath, path, line }) => (
              <Suspense fallback={<SkeletonRows label="Opening the file" />}>
                <IdentifierPeekSource worktreePath={worktreePath} path={path} line={line} />
              </Suspense>
            )}
            onClose={closeDrawer}
          />
        </Suspense>
      );
    case 'lead-details':
      return leadDetailsDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    case 'monitoring':
      return monitoringDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    case 'plan-part':
      return planPartDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    case 'pull-request':
      return (
        <DeskPr
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          mountId={drawer.payload.mountId}
          tab={drawer.payload.tab}
          check={drawer.payload.check ?? null}
          onClose={closeDrawer}
          renderChecks={renderPrChecks}
        />
      );
    case 'scripts':
      return scriptsDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    case 'terminal':
      return terminalDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    default: {
      const exhaustive: never = drawer;
      throw new Error(`unregistered drawer kind: ${String(exhaustive)}`);
    }
  }
};
