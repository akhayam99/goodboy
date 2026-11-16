import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import type { ReactNode } from 'react';
import { PaneShell } from '@goodboy/ui';
import { APP_SECTIONS, type AppSection } from './appSections';
import { BackupPage } from '../../../backup/components/BackupPage';
import { iphoneSettingsPage } from '../../../companion/iphoneSettingsPage';
import { useAppStore } from '../../../../store';
import { AppResetSection } from './AppResetSection';
import { AppAdvancedSection } from './AppAdvancedSection';
import { AppGeneralSection } from './AppGeneralSection';
import { ShortcutsSection } from './ShortcutsSection';
import { SHORTCUT_ROW_COUNT } from './shortcutRows';
import { STORAGE_APP_PAGES } from '../../../storage/storageAppPages';
import { useStorageMeta } from '../../../storage/useStorageMeta';
import { SETTINGS_PANE_ENTRY } from './settingsPaneEntry';

type Props = {
  readonly section: AppSection;
  readonly isUpdatesFocused?: boolean;
};

type PaneSection = Exclude<AppSection, 'iphone'>;

type BodyProps = {
  readonly section: PaneSection;
  readonly isUpdatesFocused: boolean;
};

const SECTION_ACTIONS: Readonly<Partial<Record<PaneSection, ReactNode>>> = {
  storage: STORAGE_APP_PAGES.storage.actions,
};

const SectionBody = ({ section, isUpdatesFocused }: BodyProps) => {
  switch (section) {
    case 'general':
      return <AppGeneralSection isUpdatesFocused={isUpdatesFocused} />;
    case 'shortcuts':
      return <ShortcutsSection />;
    case 'advanced':
      return <AppAdvancedSection />;
    case 'storage':
      return STORAGE_APP_PAGES.storage.body;
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

export const AppScopePanel = ({ section, isUpdatesFocused = false }: Props) => {
  const reportError = useAppStore((state) => state.reportError);
  const storageMeta = useStorageMeta();
  if (section === 'iphone') {
    return iphoneSettingsPage({
      animationClassName: SETTINGS_PANE_ENTRY,
      onStopFailed: (failure) => void reportError({ ...failure, recovery: CHECK_STATE }),
    });
  }
  const meta: Readonly<Partial<Record<PaneSection, string>>> = {
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
      <SectionBody section={section} isUpdatesFocused={isUpdatesFocused} />
    </PaneShell>
  );
};
