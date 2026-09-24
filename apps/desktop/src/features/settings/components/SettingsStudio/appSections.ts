export type AppSection = 'general' | 'shortcuts' | 'backup' | 'storage' | 'help' | 'danger';

export const APP_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'backup', label: 'Backup' },
  { id: 'storage', label: 'Storage' },
  { id: 'help', label: 'Help' },
  { id: 'danger', label: 'Danger zone' },
] as const satisfies ReadonlyArray<{ readonly id: AppSection; readonly label: string }>;

const DEFAULT_APP_SECTION: AppSection = 'general';

export const isAppSection = (value: string | undefined): value is AppSection =>
  APP_SECTIONS.some((section) => section.id === value);

export const appSectionOf = ({ section }: { readonly section?: string }): AppSection =>
  isAppSection(section) ? section : DEFAULT_APP_SECTION;
