import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { AppScopePanel } from './AppScopePanel';

type Props = {
  readonly initialFocus?: string;
  readonly onClose: () => void;
};

export const SettingsStudio = ({ initialFocus, onClose }: Props) => {
  return (
    <StudioShell
      icon={SECTION_ICONS.settings}
      title="Settings"
      workspaceName="App settings"
      closeLabel="close settings"
      onClose={onClose}
    >
      {(requestClose) => (
        <div className="min-h-0 flex-1">
          <AppScopePanel initialSection={initialFocus} requestClose={requestClose} />
        </div>
      )}
    </StudioShell>
  );
};
