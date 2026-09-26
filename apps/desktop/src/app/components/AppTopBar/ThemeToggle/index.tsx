import { Moon, Sun } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';
import { useThemeStore, withViewTransition } from '../../../../shared/lib/theme';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

const STATE_LABEL: Record<'dark' | 'light', string> = {
  dark: 'Dark theme',
  light: 'Light theme',
};

export const ThemeToggle = () => {
  const theme = useThemeStore((s) => s.theme);
  const preference = useThemeStore((s) => s.preference);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const next = theme === 'dark' ? 'light' : 'dark';
  const stateLabel = preference === 'system' ? `Matching system (${theme})` : STATE_LABEL[theme];
  const tooltip = `${stateLabel} · Switch to ${next}`;
  const Icon = theme === 'dark' ? Moon : Sun;

  return (
    <Tooltip
      content={tooltip}
      side="bottom"
      anchorClassName="hidden @min-chrome-narrow/topbar:flex"
    >
      <button
        type="button"
        onClick={() => withViewTransition(() => toggleTheme())}
        aria-label={tooltip}
        className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground"
      >
        <Icon
          key={theme}
          size={ICON_SIZE.control}
          aria-hidden
          className="motion-safe:animate-theme-icon-in"
        />
      </button>
    </Tooltip>
  );
};
