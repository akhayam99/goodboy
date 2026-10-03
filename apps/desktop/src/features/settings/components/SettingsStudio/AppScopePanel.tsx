import type { ReactNode } from 'react';
import { PaneShell } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { APP_SECTIONS, type AppSection } from './appSections';
import { BackupPage } from '../../../backup/components/BackupPage';
import { AppDangerSection } from './AppDangerSection';
import { AppGeneralSection } from './AppGeneralSection';
import { AppHelpSection } from './AppHelpSection';
import { SecurityFindingsSection } from './SecurityFindingsSection';
import { ShortcutsSection } from './ShortcutsSection';
import { SHORTCUT_ROW_COUNT } from './shortcutRows';
import { STORAGE_APP_PAGES } from '../../../storage/storageAppPages';
import { SETTINGS_PANE_ENTRY } from './settingsPaneEntry';

type Props = {
  readonly section: AppSection;
  readonly workspaceId: WorkspaceId | null;
  readonly requestClose: () => void;
};

const SECTION_META: Readonly<Partial<Record<AppSection, string>>> = {
  shortcuts: `${SHORTCUT_ROW_COUNT} shortcuts`,
  storage: 'What Goodboy keeps on this Mac.',
  branches: 'Local branches of your projects.',
  'security-findings': 'This text never leaves your Mac.',
};

const SECTION_ACTIONS: Readonly<Partial<Record<AppSection, ReactNode>>> = {
  storage: STORAGE_APP_PAGES.storage.actions,
  branches: STORAGE_APP_PAGES.branches.actions,
};

const SectionBody = ({ section, workspaceId, requestClose }: Props) => {
  switch (section) {
    case 'general':
      return <AppGeneralSection />;
    case 'shortcuts':
      return <ShortcutsSection />;
    case 'backup':
      return <BackupPage />;
    case 'storage':
      return STORAGE_APP_PAGES.storage.body;
    case 'branches':
      return STORAGE_APP_PAGES.branches.body;
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
      actions={SECTION_ACTIONS[section]}
    >
      <SectionBody section={section} workspaceId={workspaceId} requestClose={requestClose} />
    </PaneShell>
  );
};
