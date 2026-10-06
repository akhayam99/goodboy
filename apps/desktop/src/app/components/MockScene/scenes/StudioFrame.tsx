import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type { FooterTarget } from '../../../hooks/useAppOverlays/overlayState';
import { AppTopBar } from '../../AppTopBar';
import { ShellLeft } from '../../SideColumn/ShellLeft';
import type { ColumnPlace } from '../../SideColumn/columnPlace';
import { ToastProvider } from '../../../../shared/components/Toast';
import { useAppStore } from '../../../../store';
import { SceneFooter } from './SceneFooter';
import { sceneColumnPlace } from './sceneShell';
import { useSceneShell } from './useSceneShell';

const noop = () => undefined;

type StudioFrameProps = {
  readonly target: FooterTarget;
  readonly main: ReactNode | ((columnSlot: HTMLElement | null) => ReactNode);
  readonly columnPlace?: ColumnPlace;
};

export const StudioFrame = ({ target, main, columnPlace }: StudioFrameProps) => {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const isSettingsOpen = useAppStore((state) => state.appStudio?.kind === 'settings');
  const shell = useSceneShell({ hasActiveSession: false, isSidebarCollapsed: false });
  const { arrangement } = shell;
  const slot = arrangement.leftSlot === 'column' ? shell.settingsSlot : null;
  const place = columnPlace === undefined ? sceneColumnPlace({ target }) : columnPlace;

  return (
    <ToastProvider>
      <AppShell
        topBar={
          <AppTopBar
            mode={arrangement.mode}
            onOpenSpend={noop}
            onOpenScript={noop}
            onOpenImpact={noop}
          />
        }
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={
          arrangement.leftSlot === 'none' ? undefined : (
            <ShellLeft
              arrangement={arrangement}
              workspaceId={workspaceId}
              currentSessionId={null}
              isDraftShown={false}
              actions={shell.actions}
              onToggle={noop}
              {...(isSettingsOpen ? {} : { placeOverride: place })}
              settingsSlotRef={shell.settingsSlotRef}
            />
          )
        }
        footer={
          arrangement.footer === null ? undefined : (
            <SceneFooter scope={arrangement.footer} target={target} />
          )
        }
        main={typeof main === 'function' ? main(slot) : main}
        {...(isSettingsOpen && { studio: shell.studio })}
        studioCoversLeft={arrangement.studioCoversLeft}
      />
      {shell.layers}
    </ToastProvider>
  );
};
