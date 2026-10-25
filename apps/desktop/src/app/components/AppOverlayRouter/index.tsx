import { Suspense } from 'react';
import type { Session, Workspace } from '@goodboy/types';
import { DeleteSessionOverlay } from './DeleteSessionOverlay';
import { WorkspaceLauncher } from '../../../features/workspace/components/WorkspaceLauncher';
import type { SettingsScopeChange } from '../../../features/settings/settingsFocus';
import type { ImpactScope } from '../../../features/impact/lib';
import { OnboardingWizard } from '../../../features/onboarding/OnboardingWizard';
import { useIsMainWindow } from '../../../features/workspace/useIsMainWindow';
import type { InboxStudioFocus, StudioPlace } from '../../../store';
import { isAppScopeOverlay } from '../../hooks/useAppOverlays/overlayState';
import type { PaletteRequest } from '../../../features/palette/paletteModeTypes';
import { AppScopeOverlays } from './AppScopeOverlays';
import { AppStudio } from './AppStudio';
import type { OpenChangelogScreenParams } from './studioParams';

type Props = {
  readonly overlay: StudioPlace | null;
  readonly close: () => void;
  readonly onSettingsScopeChange: (params: SettingsScopeChange) => void;
  readonly onInboxFocusChange: (focus: InboxStudioFocus) => void;
  readonly onImpactScopeChange: (scope: ImpactScope) => void;
  readonly onOpenChangelogScreen: (params: OpenChangelogScreenParams) => void;
  readonly currentWorkspace: Workspace | null;
  readonly isWorkspaceLauncherBranch: boolean;
  readonly deleteOpen: boolean;
  readonly deleteTargetSession: Session | null;
  readonly palette: PaletteRequest | null;
  readonly closePalette: () => void;
  readonly closeDeleteConfirm: () => void;
};

export const AppOverlayRouter = ({
  overlay,
  close,
  onSettingsScopeChange,
  onInboxFocusChange,
  onImpactScopeChange,
  onOpenChangelogScreen,
  currentWorkspace,
  isWorkspaceLauncherBranch,
  deleteOpen,
  deleteTargetSession,
  palette,
  closePalette,
  closeDeleteConfirm,
}: Props) => {
  const isInMainWindow = useIsMainWindow();
  if (isWorkspaceLauncherBranch) {
    const launcherStudio =
      overlay !== null && isAppScopeOverlay({ overlay }) ? (
        <AppStudio
          overlay={overlay}
          close={close}
          onSettingsScopeChange={onSettingsScopeChange}
          onInboxFocusChange={onInboxFocusChange}
          onImpactScopeChange={onImpactScopeChange}
          onOpenChangelogScreen={onOpenChangelogScreen}
          currentWorkspace={currentWorkspace}
          workspaceProjectRoot={null}
        />
      ) : null;
    return (
      <Suspense fallback={null}>
        <WorkspaceLauncher isCreating={overlay?.kind === 'addWorkspace'} onCloseCreate={close} />
        <AppScopeOverlays studio={launcherStudio} palette={palette} closePalette={closePalette} />
        <OnboardingWizard isMainWindow={isInMainWindow} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <AppScopeOverlays studio={null} palette={palette} closePalette={closePalette} />
      {deleteTargetSession !== null ? (
        <DeleteSessionOverlay
          session={deleteTargetSession}
          isOpen={deleteOpen}
          onClose={closeDeleteConfirm}
        />
      ) : null}
      <OnboardingWizard isMainWindow={isInMainWindow} />
    </Suspense>
  );
};
