import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';

export type AppSection = 'general' | 'shortcuts' | 'advanced' | 'storage' | 'backup' | 'iphone';

export const APP_SECTIONS = [
  { id: 'general', label: 'General', concept: 'appearance' },
  { id: 'shortcuts', label: NAMES.keyboardShortcuts, concept: 'shortcuts' },
  { id: 'advanced', label: 'Advanced', concept: 'settings' },
  { id: 'storage', label: NAMES.storage, concept: 'storage' },
  { id: 'backup', label: NAMES.backupAndReset, concept: 'backup' },
  { id: 'iphone', label: NAMES.iphone, concept: 'iphone' },
] as const satisfies ReadonlyArray<{
  readonly id: AppSection;
  readonly label: string;
  readonly concept: keyof typeof CONCEPT_ICONS;
}>;

const DEFAULT_APP_SECTION: AppSection = 'general';

export const UPDATES_SECTION_ID = 'updates';

export const IPHONE_SECTION_ID: AppSection = 'iphone';

const APP_SECTION_ALIASES: ReadonlyMap<string, AppSection> = new Map<string, AppSection>([
  ['security-findings', 'storage'],
  [UPDATES_SECTION_ID, 'general'],
]);

const isAppSection = (value: string | undefined): value is AppSection =>
  APP_SECTIONS.some((section) => section.id === value);

export const appSectionOf = ({ section }: { readonly section?: string }): AppSection => {
  if (isAppSection(section)) {
    return section;
  }
  return (
    (section === undefined ? undefined : APP_SECTION_ALIASES.get(section)) ?? DEFAULT_APP_SECTION
  );
};
