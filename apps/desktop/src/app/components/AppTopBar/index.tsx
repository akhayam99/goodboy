import { useEffect, useState } from 'react';
import { Moon, Smartphone, Sun } from 'lucide-react';
import { cn, Divider, StatusDot, Tooltip, formatUsd } from '@goodboy/ui';
import { DogMascot } from '../../../shared/components/DogMascot';
import { SECTION_ICONS } from '../../../shared/components/section-icons';
import { UpdateIndicator } from '../../../features/updater/components/UpdateIndicator';
import { bridgeStatus } from '../../../features/companion/bridge';
import { useCurrentWorkspace, useSessions, useWorkspaceRollup } from '../../../store';
import { useThemeStore } from '../../../shared/lib/theme';
import { NotificationCenter } from '../../../features/notifications/components/NotificationCenter';
import { OnboardingChip } from '../../../features/onboarding/OnboardingCard';

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
        className="flex h-9 shrink-0 items-center gap-2 bg-background px-3"
      >
        <div className="flex shrink-0 items-center gap-1.5">
          <DogMascot size={15} className="shrink-0 text-foreground" />
          <span className="text-xs font-semibold tracking-tight text-foreground">Goodboy</span>
          <UpdateIndicator variant="pip" />
        </div>

        <div className="min-w-0 flex-1" />

        <button
          type="button"
          onClick={onOpenBudget}
          title="Open budget"
          className="rounded px-1.5 py-1 transition-colors hover:bg-muted/50"
        >
          <WorkspaceRollupStrip />
        </button>

        <Divider orientation="vertical" className="h-4 shrink-0 self-center" />

        <div className="flex shrink-0 items-center gap-0.5">
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
              <SECTION_ICONS.guide size={14} aria-hidden />
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
              <SECTION_ICONS.settings size={14} aria-hidden />
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
      {linked ? (
        <span aria-hidden className="ml-0.5 size-1.5 shrink-0 rounded-full bg-success" />
      ) : null}
    </button>
  );
};

const WorkspaceRollupStrip = () => {
  const workspace = useCurrentWorkspace();
  const sessions = useSessions();
  const rollup = useWorkspaceRollup(workspace?.id ?? null, sessions);
  if (!workspace) {
    return null;
  }
  return (
    <div className="flex shrink-0 items-center gap-3 text-2xs">
      {rollup.attentionCount > 0 ? (
        <span className="flex items-center gap-1">
          <StatusDot tone="warning" size="sm" pulsing />
          <span className="font-medium tabular-nums text-foreground">{rollup.attentionCount}</span>
          <span className="text-muted-foreground">need you</span>
        </span>
      ) : null}
      {rollup.runningCount > 0 ? (
        <span className="flex items-center gap-1">
          <StatusDot tone="info" size="sm" pulsing />
          <span className="font-medium tabular-nums text-foreground">{rollup.runningCount}</span>
          <span className="text-muted-foreground">running</span>
        </span>
      ) : null}
      <span className="flex items-center gap-1 text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">
          {formatUsd(rollup.todaySpend)}
        </span>
        today
      </span>
    </div>
  );
};
