import { useAppliedTheme, useThemeStore } from '../../shared/lib/theme';

export const ThemeSwitchProbe = () => {
  const theme = useAppliedTheme();
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <button type="button" onClick={toggleTheme}>
      Switch to {theme === 'dark' ? 'light' : 'dark'}
    </button>
  );
};
