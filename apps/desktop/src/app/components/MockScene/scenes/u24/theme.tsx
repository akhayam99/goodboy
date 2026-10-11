import { useEffect, type ComponentType } from 'react';
import {
  applyDocumentTheme,
  switchTheme,
  type ThemePreference,
} from '../../../../../shared/lib/theme';
import { ThemeToggle } from '../../../AppTopBar/ThemeToggle';

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
      <div className="flex h-9 shrink-0 items-center justify-end gap-1 px-2">
        <span className="text-meta text-muted-foreground">Top bar</span>
        <ThemeToggle />
      </div>
    </main>
  );
};

export const U24_THEME_SCENES: Readonly<Record<string, ComponentType>> = {
  'topbar-theme-dark': () => <ThemeFrame preference="dark" applied="dark" />,
  'topbar-theme-light': () => <ThemeFrame preference="light" applied="light" />,
  'topbar-theme-system': () => <ThemeFrame preference="system" applied="dark" />,
};
