import { useEffect, useState } from 'react';
import { Moon, Smartphone, Sun } from 'lucide-react';
import { cn, Divider, StatusDot, Tooltip } from '@goodboy/ui';
import { DogMascot } from '../../../shared/components/DogMascot';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { UpdateIndicator } from '../../../features/updater/components/UpdateIndicator';
import { bridgeStatus } from '../../../features/companion/bridge';
import { useThemeStore } from '../../../shared/lib/theme';
import { NotificationCenter } from '../../../features/notifications/components/NotificationCenter';
import { RunningScriptsIndicator } from '../../../features/scripts/components/RunningScriptsIndicator';
import { OnboardingChip } from '../../../features/onboarding/OnboardingCard';
import { WorkspaceRollupStrip } from './WorkspaceRollupStrip';

const TOPBAR_ICON_BTN =
  'flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50' as const;

export type AppTopBarProps = {
  onOpenSettings: () => void;
  onOpenBudget: () => void;
  activeStudio: string | null;
};

export const AppTopBar = ({ onOpenSettings, onOpenBudget, activeStudio }: AppTopBarProps) => {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <>
      <div
        data-tauri-drag-region
        className="relative flex h-9 shrink-0 items-center gap-2 bg-background px-3"
      >
        <div className="flex shrink-0 items-center gap-1.5">
          <DogMascot size={15} className="shrink-0 text-foreground" />
          <span className="text-xs font-semibold tracking-tight text-foreground">Goodboy</span>
        </div>

        <div className="min-w-0 flex-1" />

        <UpdateIndicator variant="pip" />

        <div className="min-w-0 flex-1" />

        <WorkspaceRollupStrip onOpenBudget={onOpenBudget} />

        <Divider orientation="vertical" className="h-4 shrink-0 self-center" />

        <div className="flex shrink-0 items-center gap-0.5">
          <RunningScriptsIndicator />
          <NotificationCenter />
          <Tooltip content={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
              className={TOPBAR_ICON_BTN}
            >
              {theme === 'dark' ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
            </button>
          </Tooltip>
          <PairDeviceCta />
          <Tooltip content="getting started">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-guide'))}
              aria-label="open getting started guide"
              className={TOPBAR_ICON_BTN}
            >
              <CONCEPT_ICONS.guide size={14} aria-hidden />
            </button>
          </Tooltip>
          <OnboardingChip />
          <Tooltip content="settings (⌘,)">
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="open settings"
              className={cn(
                'flex items-center justify-center rounded p-1.5 transition-colors',
                activeStudio === 'settings'
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <CONCEPT_ICONS.settings size={14} aria-hidden />
            </button>
          </Tooltip>
        </div>
      </div>
      <Divider />
    </>
  );
};

const PairDeviceCta = () => {
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      bridgeStatus()
        .then((s) => {
          if (active) setLinked(s.running && s.enrolledCount > 0);
        })
        .catch(() => {});
    };
    refresh();
    const id = window.setInterval(refresh, 5000);
    const onChanged = () => refresh();
    window.addEventListener('goodboy:bridge-paired-changed', onChanged);
    return () => {
      active = false;
      window.clearInterval(id);
      window.removeEventListener('goodboy:bridge-paired-changed', onChanged);
    };
  }, []);

  const label = linked ? 'iPhone linked, manage' : 'Pair your iPhone';

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-pair-device'))}
      title={label}
      aria-label={label}
      className="group/pair relative inline-flex shrink-0 items-center gap-1 rounded-full border border-border-soft/70 bg-gradient-to-b from-muted/40 to-muted/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm motion-safe:transition-all hover:border-primary/40 hover:from-primary/15 hover:to-primary/5 hover:text-primary hover:shadow-md"
    >
      <Smartphone size={11} aria-hidden />
      <span>Pair</span>
      {linked ? <StatusDot tone="success" size="sm" /> : null}
    </button>
  );
};
