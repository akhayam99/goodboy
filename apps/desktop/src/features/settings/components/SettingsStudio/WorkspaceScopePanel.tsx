import { useEffect, useRef, useState } from 'react';
import type { VerbosityLevel, WorkspaceId } from '@goodboy/types';
import { Button, FieldRow, ScrollFade, cn } from '@goodboy/ui';
import { Check, GitBranch, Unplug } from 'lucide-react';
import { SkillsPanel } from '../../../../features/skills/components/SkillsPanel';
import { ScriptsPanel } from '../../../../features/scripts';
import { VerbositySelect } from '../../../../features/session/components/VerbositySelect';
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

export const WorkspaceScopePanel = ({ workspaceId, initialSection, requestClose }: Props) => {
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const disconnect = useAppStore((s) => s.deleteWorkspace);
  const wsOverrides = useAppStore((s) => s.workspaceOverrides[workspaceId] ?? null);
  const storeSetWorkspaceOverrides = useAppStore((s) => s.setWorkspaceOverrides);
  const { showToast } = useToast();

  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [savedBranchPrefix, setSavedBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const anchorsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const verbosity = wsOverrides?.defaultVerbosity ?? 'normal';
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
        taskModels: wsOverrides?.taskModels ?? null,
        roleModels: wsOverrides?.roleModels ?? null,
        scoutFanout,
        enabledProviders: wsOverrides?.enabledProviders,
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
    <ScrollFade className="h-full w-full" viewportClassName="px-5 py-5">
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
              help="Shell scripts you run by hand. No agent, no tokens. Scripts are shared across every session of this workspace."
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
                  <Unplug size={13} aria-hidden />
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
                    className={disconnecting ? 'animate-border-pulse' : undefined}
                  >
                    {disconnecting ? (
                      'Disconnecting…'
                    ) : (
                      <>
                        <Check size={12} aria-hidden />
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
    </ScrollFade>
  );
};
