import { useEffect, useState, type ReactNode } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Button, Dialog, cn } from '@goodboy/ui';
import {
  AlertTriangle,
  Check,
  FolderCode,
  GitBranch,
  Loader2,
  Terminal,
  Unplug,
  Zap,
} from 'lucide-react';
import { SkillsPanel } from '../../../../features/skills/components/SkillsPanel';
import { PhasesPanel } from '../../../../features/phases/components/PhasesPanel';
import { ScriptsPanel } from '../../../../features/scripts';
import { formatError } from '../../../../shared/lib/errors';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../../features/settings/settings';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { useAppStore } from '../../../../store';

interface WorkspaceSettingsDialogProps {
  workspaceId: WorkspaceId;
  workspaceName: string;
  open: boolean;
  onClose: () => void;
}

type Section = 'general' | 'skills' | 'scripts' | 'phases' | 'danger';

interface NavItem {
  readonly id: Section;
  readonly label: string;
  readonly icon: ReactNode;
  readonly beta?: boolean;
  readonly tone?: 'danger';
}

export function WorkspaceSettingsDialog({
  workspaceId,
  workspaceName,
  open,
  onClose,
}: WorkspaceSettingsDialogProps) {
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const disconnect = useAppStore((s) => s.deleteWorkspace);

  const [active, setActive] = useState<Section>('general');
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [savedBranchPrefix, setSavedBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActive('general');
    setSaveState('idle');
    setError(null);
    setConfirmDisconnect(false);
    setDisconnecting(false);
    void loadSetting(settingBranchPrefix(workspaceId)).then((v) => {
      const value = v ?? DEFAULT_BRANCH_PREFIX;
      setBranchPrefix(value);
      setSavedBranchPrefix(value);
    });
  }, [open, workspaceId, loadSetting]);

  const onDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnect(workspaceId);
      onClose();
    } catch (err) {
      setError(formatError(err));
      setDisconnecting(false);
    }
  };

  const onSave = async () => {
    setSaveState('saving');
    setError(null);
    try {
      const next = branchPrefix.trim() || DEFAULT_BRANCH_PREFIX;
      await saveSetting(settingBranchPrefix(workspaceId), next);
      setSavedBranchPrefix(next);
      setBranchPrefix(next);
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setError(formatError(err));
    }
  };

  const branchPrefixDirty = branchPrefix.trim() !== savedBranchPrefix.trim();

  const navItems: ReadonlyArray<NavItem> = [
    { id: 'general', label: 'General', icon: <FolderCode size={13} aria-hidden /> },
    ...(WORKSPACE_FEATURES.skills
      ? ([{ id: 'skills', label: 'Skills', icon: <Zap size={13} aria-hidden /> }] as const)
      : []),
    { id: 'scripts', label: 'Scripts', icon: <Terminal size={13} aria-hidden /> },
    { id: 'phases', label: 'Workflows', icon: <GitBranch size={13} aria-hidden />, beta: true },
    {
      id: 'danger',
      label: 'Danger zone',
      icon: <Unplug size={13} aria-hidden />,
      tone: 'danger',
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Workspace settings"
      description={workspaceName}
      size="xl"
      className="w-[64rem] max-w-[95vw]"
      bodyClassName="px-0 py-0 gap-0"
      fixedHeightClass="h-[640px]"
      fullScreenOnSmall
      panel={
        <>
          {navItems
            .filter((i) => i.tone !== 'danger')
            .map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={() => setActive(item.id)}
              />
            ))}
          <div className="mt-auto">
            {navItems
              .filter((i) => i.tone === 'danger')
              .map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={active === item.id}
                  onClick={() => setActive(item.id)}
                />
              ))}
          </div>
        </>
      }
      footer={
        <div className="flex w-full items-center gap-2">
          <div className="flex-1 truncate">
            {error ? (
              <span className="text-xs text-danger">{error}</span>
            ) : saveState === 'saved' ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <Check size={12} aria-hidden /> Saved
              </span>
            ) : branchPrefixDirty && active === 'general' ? (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            ) : null}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {active === 'general' ? (
            <Button
              onClick={() => void onSave()}
              disabled={saveState === 'saving' || !branchPrefixDirty}
            >
              {saveState === 'saving' ? (
                <>
                  <Loader2 size={13} className="mr-1.5 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
        {active === 'general' ? (
          <GeneralSection
            branchPrefix={branchPrefix}
            setBranchPrefix={setBranchPrefix}
            busy={saveState === 'saving'}
          />
        ) : null}

        {active === 'skills' ? (
          <SectionShell
            icon={<Zap size={14} aria-hidden className="text-primary" />}
            title="Skills"
            subtitle="Reusable system-prompt fragments and tool kits that every agent in this workspace can opt into."
          >
            <SkillsPanel workspaceId={workspaceId} />
          </SectionShell>
        ) : null}

        {active === 'scripts' ? (
          <SectionShell
            icon={<Terminal size={14} aria-hidden className="text-primary" />}
            title="Scripts"
            subtitle="User-defined shell scripts you run by hand — copy env files, install deps, build. No agent, no tokens spent."
          >
            <ScriptsPanel workspaceId={workspaceId} />
          </SectionShell>
        ) : null}

        {active === 'phases' ? (
          <SectionShell
            icon={<GitBranch size={14} aria-hidden className="text-primary" />}
            title="Workflows"
            subtitle="Multi-agent blueprints offered when creating a session. Each step spawns its own agent in order."
            beta
          >
            <PhasesPanel workspaceId={workspaceId} />
          </SectionShell>
        ) : null}

        {active === 'danger' ? (
          <DangerSection
            confirmDisconnect={confirmDisconnect}
            setConfirmDisconnect={setConfirmDisconnect}
            disconnecting={disconnecting}
            onDisconnect={() => void onDisconnect()}
          />
        ) : null}
      </div>
    </Dialog>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Nav button                                                            */
/* ──────────────────────────────────────────────────────────────────── */

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const danger = item.tone === 'danger';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 rounded-md py-2 pl-3 pr-2 text-left text-sm motion-safe:transition-colors',
        active
          ? danger
            ? 'bg-danger/10 font-medium text-danger before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-danger'
            : 'bg-background font-medium text-foreground shadow-sm before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-primary'
          : danger
            ? 'text-danger/70 hover:bg-danger/5 hover:text-danger'
            : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      )}
    >
      {item.icon}
      <span className="flex-1">{item.label}</span>
      {item.beta ? (
        <span className="rounded bg-warning/20 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-warning">
          beta
        </span>
      ) : null}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Section: General                                                      */
/* ──────────────────────────────────────────────────────────────────── */

function GeneralSection({
  branchPrefix,
  setBranchPrefix,
  busy,
}: {
  branchPrefix: string;
  setBranchPrefix: (v: string) => void;
  busy: boolean;
}) {
  const sanitized = (input: string): string =>
    input
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '')
      .replace(/^-+/, '')
      .slice(0, 16);

  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<FolderCode size={14} aria-hidden className="text-primary" />}
        title="General"
        subtitle="Defaults applied when you create new sessions inside this workspace. Override per-session from the new-session dialog."
      />

      <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/50 p-4">
        <div className="flex items-center gap-2">
          <GitBranch size={13} aria-hidden className="text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Branch prefix</span>
        </div>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          Used as the default prefix in the new-session dialog. Sanitized to{' '}
          <code className="rounded bg-background px-1 font-mono">[a-z0-9-]</code>, up to 16
          characters.
        </p>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={branchPrefix}
            onChange={(e) => setBranchPrefix(sanitized(e.target.value))}
            placeholder={DEFAULT_BRANCH_PREFIX}
            disabled={busy}
            maxLength={16}
            size={16}
            aria-label="branch prefix"
            className={cn(
              'h-8 rounded-md border border-border bg-background px-2 font-mono text-sm text-foreground motion-safe:transition-colors',
              'placeholder:text-muted-foreground/40',
              'hover:border-border-strong focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              busy && 'cursor-not-allowed opacity-50',
            )}
          />
          <span className="font-mono text-sm text-muted-foreground/50">/</span>
          <span className="font-mono text-sm text-muted-foreground/40">&lt;slug&gt;</span>
          <span className="ml-auto font-mono text-2xs tabular-nums text-muted-foreground/60">
            {branchPrefix.length}/16
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-2xs text-muted-foreground/70">
          <span>Preview:</span>
          <span className="font-mono text-muted-foreground">
            {branchPrefix.trim() || DEFAULT_BRANCH_PREFIX}/refactor-auth-domain
          </span>
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Section shell (skills / init / phases reuse this header)              */
/* ──────────────────────────────────────────────────────────────────── */

function SectionShell({
  icon,
  title,
  subtitle,
  beta,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  beta?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader icon={icon} title={title} subtitle={subtitle} beta={beta} />
      <div>{children}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Section: Danger zone                                                  */
/* ──────────────────────────────────────────────────────────────────── */

function DangerSection({
  confirmDisconnect,
  setConfirmDisconnect,
  disconnecting,
  onDisconnect,
}: {
  confirmDisconnect: boolean;
  setConfirmDisconnect: (v: boolean) => void;
  disconnecting: boolean;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<AlertTriangle size={14} aria-hidden className="text-danger" />}
        title="Danger zone"
        subtitle="Hides the workspace from the sidebar. Sessions, transcripts, and worktrees stay safe on disk — re-add the same path later and everything comes back."
        tone="danger"
      />

      <div
        className={cn(
          'flex flex-col gap-3 rounded-lg border p-4 transition-colors',
          confirmDisconnect ? 'border-danger/50 bg-danger/5' : 'border-border-soft bg-background',
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Unplug size={12} aria-hidden className="text-danger" />
              Disconnect workspace
            </div>
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              Nothing is deleted. The repo and all its sessions stay in place — they just stop
              showing up in the sidebar until you re-add the path.
            </p>
          </div>
          {!confirmDisconnect ? (
            <Button
              variant="danger"
              onClick={() => setConfirmDisconnect(true)}
              disabled={disconnecting}
            >
              <Unplug size={13} aria-hidden className="mr-1.5" />
              Disconnect
            </Button>
          ) : null}
        </div>

        {confirmDisconnect ? (
          <div className="flex items-center justify-end gap-2 border-t border-danger/20 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDisconnect(false)}
              disabled={disconnecting}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={onDisconnect} disabled={disconnecting}>
              {disconnecting ? (
                <>
                  <Loader2 size={12} className="mr-1.5 animate-spin" aria-hidden />
                  Disconnecting…
                </>
              ) : (
                <>
                  <Check size={12} aria-hidden className="mr-1.5" />
                  Confirm disconnect
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Building blocks                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function SectionHeader({
  icon,
  title,
  subtitle,
  tone,
  beta,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  tone?: 'danger';
  beta?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md',
            tone === 'danger' ? 'bg-danger/10' : 'bg-primary/10',
          )}
        >
          {icon}
        </span>
        <h3
          className={cn(
            'text-base font-semibold',
            tone === 'danger' ? 'text-danger' : 'text-foreground',
          )}
        >
          {title}
        </h3>
        {beta ? (
          <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning">
            beta
          </span>
        ) : null}
      </div>
      <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
  );
}
