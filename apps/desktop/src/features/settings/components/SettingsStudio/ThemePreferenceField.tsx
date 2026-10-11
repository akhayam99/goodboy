import { FieldRow, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import { switchTheme, useThemeStore, type ThemePreference } from '../../../../shared/lib/theme';

const THEME_OPTIONS: ReadonlyArray<SegmentedTabOption<ThemePreference>> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export const ThemePreferenceField = () => {
  const preference = useThemeStore((s) => s.preference);

  return (
    <FieldRow label="Theme" help="Applies to every window.">
      <SegmentedTabs
        size="sm"
        value={preference}
        options={THEME_OPTIONS}
        onChange={(to) => switchTheme({ to })}
        ariaLabel="Theme"
      />
    </FieldRow>
  );
};
