import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';

export type AppSection = 'general' | 'devtools' | 'shortcuts' | 'storage' | 'backup' | 'iphone';

export const APP_SECTIONS = [
  {
    id: 'general',
    label: NAMES.lookAndAlerts,
    concept: 'appearance',
    searchAliases: ['General'],
  },
  {
    id: 'devtools',
    label: NAMES.editorTerminalGit,
    concept: 'terminal',
    searchAliases: ['Advanced', 'Git'],
  },
  { id: 'shortcuts', label: NAMES.keyboardShortcuts, concept: 'shortcuts', searchAliases: [] },
  {
    id: 'storage',
    label: NAMES.storageAndSearch,
    concept: 'storage',
    searchAliases: ['Search index'],
  },
  { id: 'backup', label: NAMES.backupAndReset, concept: 'backup', searchAliases: [] },
  { id: 'iphone', label: NAMES.iphone, concept: 'iphone', searchAliases: [] },
] as const satisfies ReadonlyArray<{
  readonly id: AppSection;
  readonly label: string;
  readonly concept: keyof typeof CONCEPT_ICONS;
  readonly searchAliases: ReadonlyArray<string>;
}>;

const DEFAULT_APP_SECTION: AppSection = 'general';

export const UPDATES_SECTION_ID = 'updates';

export const IPHONE_SECTION_ID: AppSection = 'iphone';

const APP_SECTION_ALIASES: ReadonlyMap<string, AppSection> = new Map<string, AppSection>([
  [UPDATES_SECTION_ID, 'general'],
  ['advanced', 'devtools'],
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
