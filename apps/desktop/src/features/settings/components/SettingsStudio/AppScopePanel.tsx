import type { WorkspaceId } from '@goodboy/types';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { APP_SECTIONS, type AppSection } from './appSections';
import { AppBackupSection } from './AppBackupSection';
import { AppDangerSection } from './AppDangerSection';
import { AppGeneralSection } from './AppGeneralSection';
import { AppHelpSection } from './AppHelpSection';
import { SecurityFindingsSection } from './SecurityFindingsSection';
import { ShortcutsSection } from './ShortcutsSection';
import { SHORTCUT_ROW_COUNT } from './shortcutRows';
import { StoragePage } from '../../../storage/components/StoragePage';
import { StorageCheckAgain } from '../../../storage/components/StoragePage/StorageCheckAgain';
import { SETTINGS_PANE_ENTRY } from './settingsPaneEntry';

type Props = {
  readonly section: AppSection;
  readonly workspaceId: WorkspaceId | null;
  readonly requestClose: () => void;
};

const SECTION_META: Readonly<Partial<Record<AppSection, string>>> = {
  shortcuts: `${SHORTCUT_ROW_COUNT} shortcuts`,
  storage: 'What Goodboy keeps on this Mac.',
  'security-findings': 'This text never leaves your Mac.',
};

const SectionBody = ({ section, workspaceId, requestClose }: Props) => {
  switch (section) {
    case 'general':
      return <AppGeneralSection />;
    case 'shortcuts':
      return <ShortcutsSection />;
    case 'backup':
      return <AppBackupSection />;
    case 'storage':
      return <StoragePage />;
    case 'security-findings':
      return <SecurityFindingsSection workspaceId={workspaceId} />;
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

export const AppScopePanel = ({ section, workspaceId, requestClose }: Props) => {
  const label = APP_SECTIONS.find((entry) => entry.id === section)?.label ?? section;
  return (
    <PaneShell
      key={section}
      animationClassName={SETTINGS_PANE_ENTRY}
      title={label}
      meta={SECTION_META[section]}
      actions={section === 'storage' ? <StorageCheckAgain /> : undefined}
    >
      <SectionBody section={section} workspaceId={workspaceId} requestClose={requestClose} />
    </PaneShell>
  );
};
