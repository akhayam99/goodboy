import { useEffect, type ComponentType } from 'react';
import {
  applyDocumentTheme,
  switchTheme,
  type ThemePreference,
} from '../../../../../shared/lib/theme';
import { ThemePreferenceField } from '../../../../../features/settings/components/SettingsStudio/ThemePreferenceField';

type FrameProps = {
  readonly preference: ThemePreference;
  readonly applied: 'dark' | 'light';
};

const ThemeFrame = ({ preference, applied }: FrameProps) => {
  useEffect(() => {
    applyDocumentTheme({ theme: applied });
    switchTheme({ to: preference });
    applyDocumentTheme({ theme: applied });
  }, [preference, applied]);

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex w-full max-w-xl flex-col p-6">
        <ThemePreferenceField />
      </div>
    </main>
  );
};

export const U24_THEME_SCENES: Readonly<Record<string, ComponentType>> = {
  'settings-theme-dark': () => <ThemeFrame preference="dark" applied="dark" />,
  'settings-theme-light': () => <ThemeFrame preference="light" applied="light" />,
  'settings-theme-system': () => <ThemeFrame preference="system" applied="dark" />,
};
