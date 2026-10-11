import { oppositeOfApplied, switchTheme, useAppliedTheme } from '../../shared/lib/theme';

export const ThemeSwitchProbe = () => {
  const theme = useAppliedTheme();

  return (
    <button type="button" onClick={() => switchTheme({ to: oppositeOfApplied() })}>
      Switch to {theme === 'dark' ? 'light' : 'dark'}
    </button>
  );
};
