import { PaneShell } from '../../../../shared/components/PaneShell';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { APP_SECTIONS, type AppSection } from './appSections';
import { AppBackupSection } from './AppBackupSection';
import { AppDangerSection } from './AppDangerSection';
import { AppGeneralSection } from './AppGeneralSection';
import { AppHelpSection } from './AppHelpSection';
import { ShortcutsSection } from './ShortcutsSection';
import { SHORTCUT_ROW_COUNT } from './shortcutRows';
import { StorageSection } from './StorageSection';

type Props = {
  readonly section: AppSection;
  readonly requestClose: () => void;
};

const BACKUP_HINT = `Export or import workspaces, ${
  WORKSPACE_FEATURES.skills ? 'skills, ' : ''
}workflows, rules, and settings as JSON.`;

const SECTION_HINT: Readonly<Record<AppSection, string>> = {
  general: 'Updates, appearance and the editor on this computer.',
  shortcuts:
    'Every keyboard shortcut, grouped by task. Each chord also shows in the tooltip of its control.',
  backup: BACKUP_HINT,
  storage: 'What the local database and archived sessions hold on this computer.',
  help: 'Guides, your phone, and feedback.',
  danger: 'Destructive local data controls.',
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
      measure="reading"
      title={label}
      description={SECTION_HINT[section]}
      meta={section === 'shortcuts' ? `${SHORTCUT_ROW_COUNT} shortcuts` : undefined}
    >
      <SectionBody section={section} requestClose={requestClose} />
    </PaneShell>
  );
};
