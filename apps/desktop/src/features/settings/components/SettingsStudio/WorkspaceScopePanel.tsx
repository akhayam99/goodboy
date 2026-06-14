import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  GhTokenStatus,
  LinearIntegrationConfig,
  ProviderId,
  SentryIntegrationConfig,
  VerbosityLevel,
  WorkspaceId,
  WorkspaceIntegration,
} from '@goodboy/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/types';
import { Button, FieldRow, cn } from '@goodboy/ui';
import { Check, GitBranch, Loader2, Unplug } from 'lucide-react';
import { PROVIDER_LABEL } from '../../../../features/chat/utils/chat-constants';
import { ProviderChip } from '../../../../features/providers/components/ProviderChip';
import { SkillsPanel } from '../../../../features/skills/components/SkillsPanel';
import { ScriptsPanel } from '../../../../features/scripts';
import { VerbositySelect } from '../../../../features/session/components/VerbositySelect';
import { ConnectLinearDialog } from '../../../../features/integrations/linear/ConnectLinearDialog';
import { ConnectSentryDialog } from '../../../../features/integrations/sentry/ConnectSentryDialog';
import { ConnectGithubDialog } from '../../../../features/integrations/github/ConnectGithubDialog';
import { ghStatus } from '../../../../features/github/github';
import { ToggleSwitch } from '../../../../shared/components/ToggleSwitch';
import { formatError } from '../../../../shared/lib/errors';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../../features/settings/settings';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly initialSection?: string;
  readonly requestClose: () => void;
};

const WORKSPACE_PROVIDER_OPTIONS: ReadonlyArray<ProviderId> = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
];

export const WorkspaceScopePanel = ({ workspaceId, initialSection, requestClose }: Props) => {
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const disconnect = useAppStore((s) => s.deleteWorkspace);
  const wsOverrides = useAppStore((s) => s.workspaceOverrides[workspaceId] ?? null);
  const storeSetWorkspaceOverrides = useAppStore((s) => s.setWorkspaceOverrides);
  const connectedProviderIds = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );
  const { showToast } = useToast();

  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [savedBranchPrefix, setSavedBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const anchorsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const verbosity = wsOverrides?.defaultVerbosity ?? 'normal';
  const defaultProvider =
    wsOverrides?.defaultProviderId ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;
  const scoutFanout = wsOverrides?.scoutFanout ?? false;

  useEffect(() => {
    void loadSetting(settingBranchPrefix(workspaceId)).then((v) => {
      const value = v ?? DEFAULT_BRANCH_PREFIX;
      setBranchPrefix(value);
      setSavedBranchPrefix(value);
    });
  }, [workspaceId, loadSetting]);

  useEffect(() => {
    if (!initialSection) {
      return;
    }
    anchorsRef.current[initialSection]?.scrollIntoView({ block: 'start' });
  }, [initialSection]);

  const persistOverrides = async (
    partial: Partial<{
      defaultProviderId: ProviderId | null;
      defaultVerbosity: VerbosityLevel;
      scoutFanout: boolean;
    }>,
    successMessage: string,
  ) => {
    setBusy(true);
    setError(null);
    try {
      await storeSetWorkspaceOverrides(workspaceId, {
        defaultProviderId: wsOverrides?.defaultProviderId ?? null,
        defaultWorkflowId: wsOverrides?.defaultWorkflowId ?? null,
        defaultBranchPrefix: wsOverrides?.defaultBranchPrefix ?? null,
        parallelEnabled: wsOverrides?.parallelEnabled ?? null,
        defaultVerbosity: verbosity,
        providerBindings: wsOverrides?.providerBindings ?? null,
        scoutFanout,
        ...partial,
      });
      showToast('success', successMessage);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const commitBranchPrefix = async () => {
    const next = branchPrefix.trim() || DEFAULT_BRANCH_PREFIX;
    if (next === savedBranchPrefix) {
      setBranchPrefix(next);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveSetting(settingBranchPrefix(workspaceId), next);
      setBranchPrefix(next);
      setSavedBranchPrefix(next);
      showToast('success', 'branch prefix saved');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnect(workspaceId);
      requestClose();
    } catch (err) {
      setError(formatError(err));
      setDisconnecting(false);
    }
  };

  const sanitized = (input: string): string =>
    input
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '')
      .replace(/^-+/, '')
      .slice(0, 16);

  const anchor = (id: string) => (el: HTMLDivElement | null) => {
    anchorsRef.current[id] = el;
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto px-8 py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <div className="flex flex-col divide-y divide-border-soft/50">
          <FieldRow label="Branch prefix" help="Prefixes every new session branch.">
            <div className="flex items-center gap-1.5">
              <GitBranch size={13} aria-hidden className="shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={branchPrefix}
                onChange={(e) => setBranchPrefix(sanitized(e.target.value))}
                onBlur={() => void commitBranchPrefix()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void commitBranchPrefix();
                  }
                }}
                placeholder={DEFAULT_BRANCH_PREFIX}
                disabled={busy}
                maxLength={16}
                size={12}
                aria-label="branch prefix"
                className={cn(
                  'h-8 rounded-md border border-border bg-background px-2 font-mono text-sm text-foreground motion-safe:transition-colors',
                  'placeholder:text-muted-foreground/40',
                  'hover:border-border-strong focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                  busy && 'cursor-not-allowed opacity-50',
                )}
              />
              <span className="font-mono text-sm text-muted-foreground/40">/&lt;slug&gt;</span>
            </div>
          </FieldRow>

          <FieldRow label="Default provider" help="New sessions start on it and can override it.">
            <div className="flex flex-wrap justify-end gap-1">
              {WORKSPACE_PROVIDER_OPTIONS.map((id) => (
                <ProviderChip
                  key={id}
                  id={id}
                  selected={defaultProvider === id}
                  disabled={busy}
                  onClick={() =>
                    void persistOverrides(
                      { defaultProviderId: id },
                      `default provider set to ${PROVIDER_LABEL[id] ?? id}`,
                    )
                  }
                  trailing={
                    connectedProviderIds.includes(id) ? null : (
                      <span className="text-[9px] uppercase tracking-wide text-warning">
                        offline
                      </span>
                    )
                  }
                />
              ))}
            </div>
          </FieldRow>

          <FieldRow label="Output verbosity" help="Response style for agents.">
            <div className="w-40">
              <VerbositySelect
                value={verbosity}
                onChange={(v) =>
                  void persistOverrides({ defaultVerbosity: v }, 'verbosity updated')
                }
                disabled={busy}
              />
            </div>
          </FieldRow>

          <div ref={anchor('scout')} className="py-4 first:pt-0 last:pb-0">
            <FieldRow
              label="Parallel scouts"
              help="Scouts split broad searches across parallel sub-scouts. Much faster on large codebases."
            >
              <ToggleSwitch
                label={scoutFanout ? 'On' : 'Off'}
                checked={scoutFanout}
                disabled={busy}
                onChange={(next) =>
                  void persistOverrides(
                    { scoutFanout: next },
                    next ? 'scout exploration on' : 'scout exploration off',
                  )
                }
              />
            </FieldRow>
          </div>

          <div ref={anchor('integrations')} className="py-4 first:pt-0 last:pb-0">
            <LinearRow workspaceId={workspaceId} />
            <SentryRow workspaceId={workspaceId} />
          </div>
          <GithubRow workspaceId={workspaceId} />

          {WORKSPACE_FEATURES.skills ? (
            <div ref={anchor('skills')} className="py-4 first:pt-0 last:pb-0">
              <FieldRow
                label="Skills"
                help="Reusable prompt fragments agents can opt into."
                layout="stacked"
              >
                <SkillsPanel workspaceId={workspaceId} />
              </FieldRow>
            </div>
          ) : null}

          <div ref={anchor('scripts')} className="py-4 first:pt-0 last:pb-0">
            <FieldRow
              label="Scripts"
              help="Shell scripts you run by hand. No agent, no tokens."
              layout="stacked"
            >
              <ScriptsPanel workspaceId={workspaceId} />
            </FieldRow>
          </div>

          <div ref={anchor('danger')} className="py-4 first:pt-0 last:pb-0">
            <FieldRow
              label="Disconnect workspace"
              help="Hides it from the sidebar. Nothing on disk is deleted, re-add the path to bring it back."
            >
              {!confirmDisconnect ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmDisconnect(true)}
                  disabled={disconnecting}
                >
                  <Unplug size={13} aria-hidden className="mr-1.5" />
                  Disconnect
                </Button>
              ) : (
                <div className="flex items-center gap-2 rounded-md bg-danger/5 px-2 py-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDisconnect(false)}
                    disabled={disconnecting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void onDisconnect()}
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <>
                        <Loader2 size={12} className="mr-1.5 animate-spin" aria-hidden />
                        Disconnecting…
                      </>
                    ) : (
                      <>
                        <Check size={12} aria-hidden className="mr-1.5" />
                        Confirm
                      </>
                    )}
                  </Button>
                </div>
              )}
            </FieldRow>
          </div>
        </div>

        {error ? <p className="pt-4 text-xs text-danger">{error}</p> : null}
      </div>
    </div>
  );
};

function LinearRow({ workspaceId }: { workspaceId: WorkspaceId }) {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const linear =
    (integrations.find((i) => i.provider === 'linear') as
      | (WorkspaceIntegration & { config: LinearIntegrationConfig })
      | undefined) ?? null;
  const [open, setOpen] = useState(false);

  return (
    <FieldRow
      label="Linear"
      help={
        linear
          ? `Connected as ${linear.config.viewerName} · linear.app/${linear.config.workspaceUrlKey}`
          : 'Pull issues assigned to you into session goals.'
      }
    >
      <Button variant={linear ? 'ghost' : 'secondary'} size="sm" onClick={() => setOpen(true)}>
        {linear ? 'Manage' : 'Connect'}
      </Button>
      <ConnectLinearDialog workspaceId={workspaceId} open={open} onClose={() => setOpen(false)} />
    </FieldRow>
  );
}

function SentryRow({ workspaceId }: { workspaceId: WorkspaceId }) {
  const integrations = useAppStore(useShallow((s) => s.workspaceIntegrations[workspaceId] ?? []));
  const sentry =
    (integrations.find((i) => i.provider === 'sentry') as
      | (WorkspaceIntegration & { config: SentryIntegrationConfig })
      | undefined) ?? null;
  const [open, setOpen] = useState(false);

  return (
    <FieldRow
      label="Sentry"
      help={
        sentry
          ? `Connected to ${sentry.config.org}/${sentry.config.project}`
          : 'Pull app issues into session goals.'
      }
    >
      <Button variant={sentry ? 'ghost' : 'secondary'} size="sm" onClick={() => setOpen(true)}>
        {sentry ? 'Manage' : 'Connect'}
      </Button>
      <ConnectSentryDialog workspaceId={workspaceId} open={open} onClose={() => setOpen(false)} />
    </FieldRow>
  );
}

function GithubRow({ workspaceId }: { workspaceId: WorkspaceId }) {
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
      : 'Resolve and act on pull requests.';

  return (
    <FieldRow label="GitHub" help={subtitle}>
      <Button variant={scoped ? 'ghost' : 'secondary'} size="sm" onClick={() => setOpen(true)}>
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
    </FieldRow>
  );
}
