import { StudioFrame } from '../StudioFrame';
import { PanelBoundary } from '../PanelBoundary';
import { renderStudio } from './renderStudio';
import type { AppStudioProps } from './studioParams';

export const AppStudio = ({
  overlay,
  close,
  onSettingsScopeChange,
  onInboxFocusChange,
  onImpactScopeChange,
  onOpenChangelogScreen,
  currentWorkspace,
  workspaceProjectRoot,
  placement = 'cover',
  settingsColumnSlot = null,
}: AppStudioProps) => {
  if (overlay === null) {
    return null;
  }
  const isInColumnShell = placement === 'content';
  const isColumnSettings = overlay.kind === 'settings' && isInColumnShell;
  return (
    <StudioFrame
      kind={overlay.kind}
      onClose={close}
      placement={placement}
      isClosable={!isColumnSettings}
      hasBand={!isColumnSettings}
    >
      <PanelBoundary key={overlay.kind} leaveLabel="Close" onLeave={close}>
        {renderStudio({
          overlay,
          close,
          onSettingsScopeChange,
          onInboxFocusChange,
          onImpactScopeChange,
          onOpenChangelogScreen,
          currentWorkspace,
          workspaceProjectRoot,
          settingsColumnSlot,
          isInColumnShell,
        })}
      </PanelBoundary>
    </StudioFrame>
  );
};
