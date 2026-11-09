import type { ReactNode } from 'react';
import type { DrawerRequest } from '../../store/slices/drawer/state';
import { askDrawerRegistration } from '../../features/session/ask/askDrawerRegistration';
import { browserDrawerRegistration } from '../../features/browser/browserDrawerRegistration';
import { checkAnalysisDrawerRegistration } from '../../features/branch/checkAnalysisDrawerRegistration';
import { fileDiffDrawerRegistration } from '../../features/diff/fileDiffDrawerRegistration';
import { IdentifierPeekDrawer } from '../../features/diff/components/IdentifierPeekDrawer';
import { drawerKey } from '../../store/slices/drawer/drawerKey';
import { IdentifierPeekSource } from './IdentifierPeekSource';
import { historyVersionsDrawerRegistration } from '../../features/history/historyVersionsDrawerRegistration';
import { planPartDrawerRegistration } from '../../features/plans/planPartDrawerRegistration';
import { terminalDrawerRegistration } from '../../features/terminal/terminalDrawerRegistration';

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
      | 'plan-part'
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
        <IdentifierPeekDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          worktreePath={drawer.payload.worktreePath}
          word={drawer.payload.word}
          selected={drawer.payload.selected}
          renderSource={({ worktreePath, path, line }) => (
            <IdentifierPeekSource worktreePath={worktreePath} path={path} line={line} />
          )}
          onClose={closeDrawer}
        />
      );
    case 'plan-part':
      return planPartDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    case 'terminal':
      return terminalDrawerRegistration.render({ drawer, closeDrawer, openDrawer });
    default: {
      const exhaustive: never = drawer;
      throw new Error(`unregistered drawer kind: ${String(exhaustive)}`);
    }
  }
};
