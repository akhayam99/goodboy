import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  DEFAULT_THEME_PREFERENCE,
  switchTheme,
  useThemeStore,
  type ThemePreference,
} from '../../../../shared/lib/theme';
import { SettingRow } from './SettingRow';

const THEME_OPTIONS: ReadonlyArray<SegmentedTabOption<ThemePreference>> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export const ThemePreferenceField = () => {
  const preference = useThemeStore((s) => s.preference);

  return (
    <SettingRow
      label="Theme"
      rowKey="theme"
      help="Applies to every window."
      isChanged={preference !== DEFAULT_THEME_PREFERENCE}
      onReset={() => switchTheme({ to: DEFAULT_THEME_PREFERENCE })}
    >
      <SegmentedTabs
        size="sm"
        value={preference}
        options={THEME_OPTIONS}
        onChange={(to) => switchTheme({ to })}
        ariaLabel="Theme"
      />
    </SettingRow>
  );
};
