import { useState, type ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type { FooterTarget } from '../../../hooks/useAppOverlays/overlayState';
import { AppTopBar } from '../../AppTopBar';
import { ShellLeft } from '../../SideColumn/ShellLeft';
import type { ColumnPlace } from '../../SideColumn/columnPlace';
import { ToastProvider } from '../../../../shared/components/Toast';
import { useAppStore } from '../../../../store';
import { shellArrangement } from '../../../shellArrangement';
import { SceneFooter } from './SceneFooter';
import { SCENE_COLUMN_ACTIONS, sceneColumnPlace, sceneShellMode } from './sceneShell';

const noop = () => undefined;

type StudioFrameProps = {
  readonly target: FooterTarget;
  readonly main: ReactNode | ((columnSlot: HTMLElement | null) => ReactNode);
  readonly columnPlace?: ColumnPlace;
};

export const StudioFrame = ({ target, main, columnPlace }: StudioFrameProps) => {
  const [columnSlot, setColumnSlot] = useState<HTMLDivElement | null>(null);
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const arrangement = shellArrangement({
    hasWorkspace: true,
    hasActiveSession: false,
    isSidebarCollapsed: false,
    mode: sceneShellMode(),
  });
  const slot = arrangement.leftSlot === 'column' ? columnSlot : null;

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
              actions={SCENE_COLUMN_ACTIONS}
              onToggle={noop}
              placeOverride={columnPlace === undefined ? sceneColumnPlace({ target }) : columnPlace}
              settingsSlotRef={setColumnSlot}
            />
          )
        }
        footer={
          arrangement.footer === null ? undefined : (
            <SceneFooter scope={arrangement.footer} target={target} />
          )
        }
        main={typeof main === 'function' ? main(slot) : main}
      />
    </ToastProvider>
  );
};
