import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { AppScopePanel } from './AppScopePanel';

type Props = {
  readonly initialFocus?: string;
  readonly onClose: () => void;
};

export const SettingsStudio = ({ initialFocus, onClose }: Props) => {
  return (
    <StudioShell
      icon={CONCEPT_ICONS.settings}
      tone={CONCEPT_TONE.settings}
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
