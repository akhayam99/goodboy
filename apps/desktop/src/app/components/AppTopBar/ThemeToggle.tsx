import { IconButton, TOP_BAR_CONTROL, cn } from '@goodboy/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  oppositeOfApplied,
  switchTheme,
  useAppliedTheme,
  useThemeStore,
} from '../../../shared/lib/theme';

export const ThemeToggle = () => {
  const applied = useAppliedTheme();
  const preference = useThemeStore((s) => s.preference);
  const opposite = oppositeOfApplied();
  const label =
    preference === 'system'
      ? `Matching system (${applied}). Switch to ${opposite}`
      : `${applied === 'dark' ? 'Dark' : 'Light'} theme. Switch to ${opposite}`;
  const icon = preference === 'system' ? Monitor : applied === 'dark' ? Moon : Sun;

  return (
    <IconButton
      icon={icon}
      label={label}
      size="sm"
      className={cn(TOP_BAR_CONTROL.radius)}
      onClick={() => switchTheme({ to: opposite })}
    />
  );
};
