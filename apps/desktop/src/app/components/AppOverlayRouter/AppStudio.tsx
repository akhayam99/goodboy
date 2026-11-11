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
}: AppStudioProps) => {
  if (overlay === null) {
    return null;
  }
  return (
    <StudioFrame kind={overlay.kind} onClose={close} placement={placement}>
      <PanelBoundary
        key={overlay.kind === 'changelog' ? 'guide' : overlay.kind}
        leaveLabel="Close"
        onLeave={close}
      >
        {renderStudio({
          overlay,
          close,
          onSettingsScopeChange,
          onInboxFocusChange,
          onImpactScopeChange,
          onOpenChangelogScreen,
          currentWorkspace,
          workspaceProjectRoot,
          railPlacement: placement === 'content' ? 'page' : 'chrome',
        })}
      </PanelBoundary>
    </StudioFrame>
  );
};
