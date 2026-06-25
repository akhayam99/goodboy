import { useEffect, useState } from 'react';
import { DollarSign, HelpCircle, Moon, Settings, Smartphone, Sun } from 'lucide-react';
import { Divider, StatusDot, formatUsd } from '@goodboy/ui';
import { DogMascot } from '../../../shared/components/DogMascot';
import { UpdateIndicator } from '../../../features/updater/components/UpdateIndicator';
import { bridgeStatus } from '../../../features/companion/bridge';
import { useCurrentWorkspace, useSessions, useWorkspaceRollup, useAppStore } from '../../../store';
import { useThemeStore } from '../../../shared/lib/theme';
import { NotificationCenter } from '../../../features/notifications/components/NotificationCenter';
import { OnboardingChip } from '../../../features/onboarding/OnboardingCard';
import { QuickActionsRow } from '../../../features/workspace/components/WorkspacesSidebar/parts/QuickActionsRow';
import { WORKSPACE_FEATURES } from '../../../shared/lib/features';
import type { WorkspaceId } from '@goodboy/types';

const TOPBAR_ICON_BTN =
  'flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50' as const;

export type AppTopBarProps = {
  onOpenSettings: () => void;
  onOpenPalette: (initialQuery?: string) => void;
  onOpenWorkflows: () => void;
  onOpenLinear: () => void;
  onOpenSentry: () => void;
  onOpenGitlab: () => void;
  onOpenProviders: () => void;
  onOpenGithub: () => void;
  onOpenBudget: () => void;
};

export const AppTopBar = ({
  onOpenSettings,
  onOpenPalette,
  onOpenWorkflows,
  onOpenLinear,
  onOpenSentry,
  onOpenGitlab,
  onOpenProviders,
  onOpenGithub,
  onOpenBudget,
}: AppTopBarProps) => {
  const currentWorkspace = useCurrentWorkspace();
  const hasLinear = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'linear',
    ),
  );
  const hasSentry = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'sentry',
    ),
  );
  const hasGitlab = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'gitlab',
    ),
  );
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

        <WorkspaceRollupStrip />

        {currentWorkspace ? (
          <QuickActionsRow
            onOpenPalette={onOpenPalette}
            onOpenWorkflows={onOpenWorkflows}
            onOpenLinear={onOpenLinear}
            onOpenSentry={onOpenSentry}
            onOpenGitlab={onOpenGitlab}
            onOpenProviders={onOpenProviders}
            onOpenGithub={onOpenGithub}
            linearEnabled={hasLinear}
            sentryEnabled={hasSentry}
            gitlabEnabled={hasGitlab}
            skillsEnabled={WORKSPACE_FEATURES.skills}
            compact
          />
        ) : null}

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onOpenBudget}
            title="open budget studio"
            aria-label="open budget studio"
            className={TOPBAR_ICON_BTN}
          >
            <DollarSign size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
            aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
            className={TOPBAR_ICON_BTN}
          >
            {theme === 'dark' ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
          </button>
          <NotificationCenter />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-guide'))}
            title="getting started"
            aria-label="open getting started guide"
            className={TOPBAR_ICON_BTN}
          >
            <HelpCircle size={14} aria-hidden />
          </button>
          <OnboardingChip />
          <PairDeviceCta />
          <button
            type="button"
            onClick={onOpenSettings}
            title="settings (⌘,)"
            aria-label="open settings"
            className={TOPBAR_ICON_BTN}
          >
            <Settings size={14} aria-hidden />
          </button>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/15">
            Beta
          </span>
        </div>
      </div>
      <Divider />
    </>
  );
};

function PairDeviceCta() {
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

  const label = linked ? 'iPhone linked — manage' : 'Pair your iPhone';

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
}

function WorkspaceRollupStrip() {
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
}
