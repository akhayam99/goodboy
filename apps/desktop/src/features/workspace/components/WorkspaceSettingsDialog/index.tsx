import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GhTokenStatus, ProviderId, VerbosityLevel, WorkspaceId } from '@goodboy/types';
import { Button, Dialog, cn } from '@goodboy/ui';
import {
  AlertTriangle,
  Check,
  FolderCode,
  GitBranch,
  GitFork,
  Link2,
  Loader2,
  Sparkles,
  Telescope,
  Terminal,
  Unplug,
  Zap,
} from 'lucide-react';
import { PROVIDER_LABEL } from '../../../../features/chat/utils/chat-constants';
import { SkillsPanel } from '../../../../features/skills/components/SkillsPanel';
import { ScriptsPanel } from '../../../../features/scripts';
import { VerbositySelect } from '../../../../features/session/components/VerbositySelect';
import { ConnectLinearDialog } from '../../../../features/integrations/linear/ConnectLinearDialog';
import { ConnectGithubDialog } from '../../../../features/integrations/github/ConnectGithubDialog';
import { ghStatus } from '../../../../features/github/github';
import { formatError } from '../../../../shared/lib/errors';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../../features/settings/settings';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { useAppStore } from '../../../../store';

interface Props {
  workspaceId: WorkspaceId;
  workspaceName: string;
  open: boolean;
  onClose: () => void;
  /** Tab to open on, e.g. deep-linked from the command palette. */
  initialSection?: string;
}

type Section = 'general' | 'integrations' | 'skills' | 'scripts' | 'phases' | 'scout' | 'danger';

function isSection(value: string | undefined): value is Section {
  return (
    value === 'general' ||
    value === 'integrations' ||
    value === 'skills' ||
    value === 'scripts' ||
    value === 'phases' ||
    value === 'scout' ||
    value === 'danger'
  );
}

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
  initialSection,
}: Props) {
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const disconnect = useAppStore((s) => s.deleteWorkspace);
  const wsOverrides = useAppStore((s) => s.workspaceOverrides[workspaceId] ?? null);
  const storeSetWorkspaceOverrides = useAppStore((s) => s.setWorkspaceOverrides);

  // useShallow because the selector derives a fresh array each call; without
  // shallow comparison useSyncExternalStore detects a snapshot mismatch on
  // every render and React 19 bails into an infinite render loop.
  const connectedProviderIds = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );

  const [active, setActive] = useState<Section>('general');
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [savedBranchPrefix, setSavedBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [verbosity, setVerbosity] = useState<VerbosityLevel>('normal');
  const [savedVerbosity, setSavedVerbosity] = useState<VerbosityLevel>('normal');
  const [defaultProvider, setDefaultProvider] = useState<ProviderId | null>(null);
  const [savedDefaultProvider, setSavedDefaultProvider] = useState<ProviderId | null>(null);
  const [scoutFanout, setScoutFanout] = useState(false);
  const [savedScoutFanout, setSavedScoutFanout] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActive(isSection(initialSection) ? initialSection : 'general');
    setSaveState('idle');
    setError(null);
    setConfirmDisconnect(false);
    setDisconnecting(false);
    void loadSetting(settingBranchPrefix(workspaceId)).then((v) => {
      const value = v ?? DEFAULT_BRANCH_PREFIX;
      setBranchPrefix(value);
      setSavedBranchPrefix(value);
    });
    const savedVerbosityValue = wsOverrides?.defaultVerbosity ?? 'normal';
    setVerbosity(savedVerbosityValue);
    setSavedVerbosity(savedVerbosityValue);
    const savedProvider = wsOverrides?.defaultProviderId ?? null;
    setDefaultProvider(savedProvider);
    setSavedDefaultProvider(savedProvider);
    const savedScout = wsOverrides?.scoutFanout ?? false;
    setScoutFanout(savedScout);
    setSavedScoutFanout(savedScout);
  }, [open, workspaceId, loadSetting, initialSection, wsOverrides]);

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
      const mergedOverrides = {
        defaultProviderId: defaultProvider,
        defaultWorkflowId: wsOverrides?.defaultWorkflowId ?? null,
        defaultBranchPrefix: wsOverrides?.defaultBranchPrefix ?? null,
        parallelEnabled: wsOverrides?.parallelEnabled ?? null,
        defaultVerbosity: verbosity,
        providerBindings: wsOverrides?.providerBindings ?? null,
        scoutFanout,
      };
      await storeSetWorkspaceOverrides(workspaceId, mergedOverrides);
      setSavedVerbosity(verbosity);
      setSavedDefaultProvider(defaultProvider);
      setSavedScoutFanout(scoutFanout);
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setError(formatError(err));
    }
  };

  const branchPrefixDirty = branchPrefix.trim() !== savedBranchPrefix.trim();
  const verbosityDirty = verbosity !== savedVerbosity;
  const providerDirty = defaultProvider !== savedDefaultProvider;
  const scoutDirty = scoutFanout !== savedScoutFanout;
  const settingsDirty = branchPrefixDirty || verbosityDirty || providerDirty || scoutDirty;

  const navItems: ReadonlyArray<NavItem> = [
    { id: 'general', label: 'General', icon: <FolderCode size={13} aria-hidden /> },
    { id: 'integrations', label: 'Integrations', icon: <Link2 size={13} aria-hidden /> },
    ...(WORKSPACE_FEATURES.skills
      ? ([{ id: 'skills', label: 'Skills', icon: <Zap size={13} aria-hidden /> }] as const)
      : []),
    { id: 'scripts', label: 'Scripts', icon: <Terminal size={13} aria-hidden /> },
    { id: 'scout', label: 'Scout exploration', icon: <Telescope size={13} aria-hidden /> },
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
            ) : settingsDirty && (active === 'general' || active === 'scout') ? (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            ) : null}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {active === 'general' || active === 'scout' ? (
            <Button
              onClick={() => void onSave()}
              disabled={saveState === 'saving' || !settingsDirty}
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
            verbosity={verbosity}
            setVerbosity={setVerbosity}
            defaultProvider={defaultProvider}
            setDefaultProvider={setDefaultProvider}
            connectedProviderIds={connectedProviderIds}
            busy={saveState === 'saving'}
          />
        ) : null}

        {active === 'integrations' ? (
          <SectionShell
            icon={<Link2 size={14} aria-hidden className="text-primary" />}
            title="Integrations"
            subtitle="Connect external task managers so new sessions can pull issues assigned to you and auto-fill the goal."
          >
            <IntegrationsPanel workspaceId={workspaceId} />
          </SectionShell>
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
            subtitle="User-defined shell scripts you run by hand, copy env files, install deps, build. No agent, no tokens spent."
          >
            <ScriptsPanel workspaceId={workspaceId} />
          </SectionShell>
        ) : null}

        {active === 'scout' ? (
          <SectionShell
            icon={<Telescope size={14} aria-hidden className="text-primary" />}
            title="Scout exploration"
            subtitle="Let a scout split a broad search across parallel sub-scouts to cover large codebases faster."
          >
            <ScoutSection
              enabled={scoutFanout}
              onChange={setScoutFanout}
              busy={saveState === 'saving'}
            />
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
  verbosity,
  setVerbosity,
  defaultProvider,
  setDefaultProvider,
  connectedProviderIds,
  busy,
}: {
  branchPrefix: string;
  setBranchPrefix: (v: string) => void;
  verbosity: VerbosityLevel;
  setVerbosity: (v: VerbosityLevel) => void;
  defaultProvider: ProviderId | null;
  setDefaultProvider: (v: ProviderId | null) => void;
  connectedProviderIds: ReadonlyArray<ProviderId>;
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

      <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/50 p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={13} aria-hidden className="text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Default provider</span>
        </div>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          New sessions in this workspace start with this provider. Each session can override it from
          its own settings without affecting siblings.
        </p>
        <DefaultProviderPicker
          value={defaultProvider}
          onChange={setDefaultProvider}
          connected={connectedProviderIds}
          disabled={busy}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/50 p-4">
        <div className="flex items-center gap-2">
          <Zap size={13} aria-hidden className="text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Output verbosity</span>
        </div>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          Default response style for agents in this workspace. Each agent can override per-session.
        </p>
        <div className="max-w-xs">
          <VerbositySelect value={verbosity} onChange={setVerbosity} disabled={busy} />
        </div>
      </div>
    </div>
  );
}

const PROVIDER_OPTIONS: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex', 'gemini'];

function DefaultProviderPicker({
  value,
  onChange,
  connected,
  disabled,
}: {
  value: ProviderId | null;
  onChange: (v: ProviderId | null) => void;
  connected: ReadonlyArray<ProviderId>;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs motion-safe:transition-colors',
          value === null
            ? 'border-primary/40 bg-primary/10 font-medium text-primary'
            : 'border-border-soft bg-background text-muted-foreground hover:border-border hover:text-foreground',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        title="Use global default"
      >
        Inherit global
      </button>
      {PROVIDER_OPTIONS.map((id) => {
        const active = value === id;
        const isConnected = connected.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            disabled={disabled}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs motion-safe:transition-colors',
              active
                ? 'border-primary/40 bg-primary/10 font-medium text-primary'
                : 'border-border-soft bg-background text-muted-foreground hover:border-border hover:text-foreground',
              !isConnected && 'opacity-60',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            title={isConnected ? undefined : 'CLI not connected'}
          >
            {PROVIDER_LABEL[id]}
            {!isConnected ? (
              <span className="text-[9px] uppercase tracking-wide text-warning">offline</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Section: Integrations                                                 */
/* ──────────────────────────────────────────────────────────────────── */

function IntegrationsPanel({ workspaceId }: { workspaceId: WorkspaceId }) {
  // Same snapshot-stability fix as connectedProviderIds: `?? []` returns a
  // fresh array on every missing-key lookup, which causes useSyncExternalStore
  // to loop.
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const linear = integrations.find((i) => i.provider === 'linear') ?? null;
  const [linearOpen, setLinearOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border-soft bg-subtle/30 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-provider-linear text-xs font-bold text-white">
            L
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Linear</span>
            <span className="text-2xs text-muted-foreground">
              {linear
                ? `Connected as ${linear.config.viewerName} · linear.app/${linear.config.workspaceUrlKey}`
                : 'Pull issues assigned to you and auto-fill session goals.'}
            </span>
          </div>
        </div>
        <Button variant={linear ? 'ghost' : 'primary'} onClick={() => setLinearOpen(true)}>
          {linear ? 'Manage' : 'Connect'}
        </Button>
      </div>

      <ConnectLinearDialog
        workspaceId={workspaceId}
        open={linearOpen}
        onClose={() => setLinearOpen(false)}
      />

      <GithubCard workspaceId={workspaceId} />
    </div>
  );
}

function GithubCard({ workspaceId }: { workspaceId: WorkspaceId }) {
  const [status, setStatus] = useState<GhTokenStatus | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await ghStatus(workspaceId));
    } catch {
      setStatus(null);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scoped = status?.scoped ?? false;
  const subtitle = scoped
    ? `Connected as ${status?.user ?? '(unknown)'} · this workspace`
    : status?.user
      ? `Using system gh (${status.user}). Connect a token to override.`
      : 'Resolve and act on pull requests for this workspace.';

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-soft bg-subtle/30 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
          <GitFork size={16} aria-hidden />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-foreground">GitHub</span>
          <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
        </div>
      </div>
      <Button variant={scoped ? 'ghost' : 'primary'} onClick={() => setOpen(true)}>
        {scoped ? 'Manage' : 'Connect'}
      </Button>

      <ConnectGithubDialog
        workspaceId={workspaceId}
        open={open}
        onClose={() => {
          setOpen(false);
          void refresh();
        }}
      />
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
/* Section: Scout exploration                                            */
/* ──────────────────────────────────────────────────────────────────── */

function ScoutSection({
  enabled,
  onChange,
  busy,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={busy}
        onClick={() => onChange(!enabled)}
        className={cn(
          'flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left motion-safe:transition-colors',
          enabled ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40',
        )}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            Let scouts split into parallel sub-scouts
          </span>
          <span className="text-xs text-muted-foreground">
            When a search spans several areas, the scout maps them, then explores each in parallel.
          </span>
        </span>
        <span
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full motion-safe:transition-colors',
            enabled ? 'bg-primary' : 'bg-muted-foreground/30',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 size-4 rounded-full bg-background shadow-sm motion-safe:transition-all',
              enabled ? 'left-[18px]' : 'left-0.5',
            )}
          />
        </span>
      </button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Faster on large codebases: parallel scouts each read one area, so no single context grows
        huge. It costs slightly more tokens, since every sub-scout is told which area to read. On a
        focused question a single scout still answers directly.
      </p>
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
        subtitle="Hides the workspace from the sidebar. Sessions, transcripts, and worktrees stay safe on disk, re-add the same path later and everything comes back."
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
              Nothing is deleted. The repo and all its sessions stay in place, they just stop
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
