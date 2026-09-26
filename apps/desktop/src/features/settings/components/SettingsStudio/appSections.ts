import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

export type AppSection =
  'general' | 'shortcuts' | 'backup' | 'storage' | 'security-findings' | 'help' | 'danger';

export const APP_SECTIONS = [
  { id: 'general', label: 'General', concept: 'appearance' },
  { id: 'shortcuts', label: 'Shortcuts', concept: 'shortcuts' },
  { id: 'backup', label: 'Backup', concept: 'backup' },
  { id: 'storage', label: 'Storage', concept: 'storage' },
  { id: 'security-findings', label: 'Security findings', concept: 'security' },
  { id: 'help', label: 'Help', concept: 'help' },
  { id: 'danger', label: 'Danger zone', concept: 'danger' },
] as const satisfies ReadonlyArray<{
  readonly id: AppSection;
  readonly label: string;
  readonly concept: keyof typeof CONCEPT_ICONS;
}>;

const DEFAULT_APP_SECTION: AppSection = 'general';

export const isAppSection = (value: string | undefined): value is AppSection =>
  APP_SECTIONS.some((section) => section.id === value);

export const appSectionOf = ({ section }: { readonly section?: string }): AppSection =>
  isAppSection(section) ? section : DEFAULT_APP_SECTION;
