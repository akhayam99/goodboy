import { PaneShell } from '../../../../shared/components/PaneShell';
import { APP_SECTIONS, type AppSection } from './appSections';
import { AppBackupSection } from './AppBackupSection';
import { AppDangerSection } from './AppDangerSection';
import { AppGeneralSection } from './AppGeneralSection';
import { AppHelpSection } from './AppHelpSection';
import { ShortcutsSection } from './ShortcutsSection';
import { SHORTCUT_ROW_COUNT } from './shortcutRows';
import { StorageSection } from './StorageSection';
import { SETTINGS_PANE_ENTRY } from './settingsPaneEntry';

type Props = {
  readonly section: AppSection;
  readonly requestClose: () => void;
};

const SectionBody = ({ section, requestClose }: Props) => {
  switch (section) {
    case 'general':
      return <AppGeneralSection />;
    case 'shortcuts':
      return <ShortcutsSection />;
    case 'backup':
      return <AppBackupSection />;
    case 'storage':
      return <StorageSection />;
    case 'help':
      return <AppHelpSection requestClose={requestClose} />;
    case 'danger':
      return <AppDangerSection />;
    default: {
      const exhaustive: never = section;
      return exhaustive;
    }
  }
};

export const AppScopePanel = ({ section, requestClose }: Props) => {
  const label = APP_SECTIONS.find((entry) => entry.id === section)?.label ?? section;
  return (
    <PaneShell
      key={section}
      animationClassName={SETTINGS_PANE_ENTRY}
      title={label}
      meta={section === 'shortcuts' ? `${SHORTCUT_ROW_COUNT} shortcuts` : undefined}
    >
      <SectionBody section={section} requestClose={requestClose} />
    </PaneShell>
  );
};
