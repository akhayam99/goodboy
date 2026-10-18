import type { ReactNode } from 'react';
import { PaneShell } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { APP_SECTIONS, type AppSection } from './appSections';
import { BackupPage } from '../../../backup/components/BackupPage';
import { iphoneSettingsPage } from '../../../companion/iphoneSettingsPage';
import { APP_VERSION } from '../../../../shared/lib/appVersion';
import { useAppStore } from '../../../../store';
import { AppResetSection } from './AppResetSection';
import { AppGeneralSection } from './AppGeneralSection';
import { SecurityFindingsSection } from './SecurityFindingsSection';
import { ShortcutsSection } from './ShortcutsSection';
import { UpdatesSection } from './UpdatesSection';
import { UpdatesWhatsNewBand } from './UpdatesWhatsNewBand';
import { SHORTCUT_ROW_COUNT } from './shortcutRows';
import { STORAGE_APP_PAGES } from '../../../storage/storageAppPages';
import { useStorageMeta } from '../../../storage/useStorageMeta';
import { SETTINGS_PANE_ENTRY } from './settingsPaneEntry';

type Props = {
  readonly section: AppSection;
  readonly workspaceId: WorkspaceId | null;
};

type PaneSection = Exclude<AppSection, 'iphone'>;

type BodyProps = {
  readonly section: PaneSection;
  readonly workspaceId: WorkspaceId | null;
};

const SECTION_ACTIONS: Readonly<Partial<Record<PaneSection, ReactNode>>> = {
  storage: STORAGE_APP_PAGES.storage.actions,
};

const SectionBody = ({ section, workspaceId }: BodyProps) => {
  switch (section) {
    case 'general':
      return <AppGeneralSection />;
    case 'updates':
      return (
        <>
          <UpdatesSection />
          <UpdatesWhatsNewBand />
        </>
      );
    case 'shortcuts':
      return <ShortcutsSection />;
    case 'storage':
      return (
        <>
          {STORAGE_APP_PAGES.storage.body}
          <SecurityFindingsSection workspaceId={workspaceId} />
        </>
      );
    case 'backup':
      return (
        <>
          <BackupPage />
          <AppResetSection />
        </>
      );
    default: {
      const exhaustive: never = section;
      return exhaustive;
    }
  }
};

export const AppScopePanel = ({ section, workspaceId }: Props) => {
  const reportError = useAppStore((state) => state.reportError);
  const storageMeta = useStorageMeta();
  if (section === 'iphone') {
    return iphoneSettingsPage({
      animationClassName: SETTINGS_PANE_ENTRY,
      onStopFailed: (failure) => void reportError(failure),
    });
  }
  const meta: Readonly<Partial<Record<PaneSection, string>>> = {
    updates: APP_VERSION === null ? undefined : `Goodboy ${APP_VERSION}`,
    shortcuts: `${SHORTCUT_ROW_COUNT} shortcuts`,
    storage: storageMeta,
  };
  const label = APP_SECTIONS.find((entry) => entry.id === section)?.label ?? section;
  return (
    <PaneShell
      page="settings"
      key={section}
      animationClassName={SETTINGS_PANE_ENTRY}
      title={label}
      meta={meta[section]}
      actions={SECTION_ACTIONS[section]}
    >
      <SectionBody section={section} workspaceId={workspaceId} />
    </PaneShell>
  );
};
