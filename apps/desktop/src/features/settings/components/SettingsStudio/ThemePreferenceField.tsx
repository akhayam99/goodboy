import { FieldRow, Listbox, type ListboxOption } from '@goodboy/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeStore, type ThemePreference } from '../../../../shared/lib/theme';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

const THEME_OPTIONS: ReadonlyArray<ListboxOption<ThemePreference>> = [
  { value: 'system', label: 'Match system', leading: <Monitor size={ICON_SIZE.row} /> },
  { value: 'light', label: 'Light', leading: <Sun size={ICON_SIZE.row} /> },
  { value: 'dark', label: 'Dark', leading: <Moon size={ICON_SIZE.row} /> },
];

export const ThemePreferenceField = () => {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <FieldRow label="Theme" help="Applies to every window.">
      <Listbox
        size="sm"
        value={preference}
        options={THEME_OPTIONS}
        onChange={setPreference}
        ariaLabel="Theme"
      />
    </FieldRow>
  );
};
