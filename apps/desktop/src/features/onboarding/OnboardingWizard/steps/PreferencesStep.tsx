import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { OverrideSettings, Project, VerbosityLevel, WorkspaceId } from '@goodboy/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/types';
import { Button, cn, EmptyState, FieldRow, formatError, Switch } from '@goodboy/ui';
import { FolderGit2, GitBranch, SlidersHorizontal } from 'lucide-react';
import { VerbositySelect } from '../../../session/components/VerbositySelect';
import { DEFAULT_BRANCH_PREFIX } from '../../../settings/settings';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ProviderPicker } from '../../../../shared/components/RoutingPicker/ProviderPicker';

type Props = {
  readonly workspaceId: WorkspaceId | null;
  readonly projectKind?: Project['kind'] | null;
};

const sanitizePrefix = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/^-+/, '')
    .slice(0, 16);

export const PreferencesStep = ({ workspaceId, projectKind = 'repo' }: Props) => {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-primary">
        <SlidersHorizontal size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Set your defaults</h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          A few preferences for this workspace. Every new session inherits them, and you can change
          any of it later in settings.
        </p>
      </div>

      {workspaceId === null ? (
        <EmptyState
          bordered
          icon={CONCEPT_ICONS.workspace}
          tone={CONCEPT_TONE.workspace}
          title="Add a workspace first to set its defaults."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('goodboy:add-workspace'))}
            >
              <FolderGit2 size={14} aria-hidden /> Add workspace
            </Button>
          }
        />
      ) : (
        <PreferencesForm workspaceId={workspaceId} isSimple={projectKind === 'folder'} />
      )}
    </div>
  );
};

type FormProps = {
  readonly workspaceId: WorkspaceId;
  readonly isSimple: boolean;
};

const PreferencesForm = ({ workspaceId, isSimple }: FormProps) => {
  const wsOverrides = useAppStore((s) => s.workspaceOverrides[workspaceId] ?? null);
  const setWorkspaceOverrides = useAppStore((s) => s.setWorkspaceOverrides);
  const connectedProviderIds = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );

  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [savedBranchPrefix, setSavedBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verbosity = wsOverrides?.defaultVerbosity ?? 'normal';
  const defaultProvider =
    wsOverrides?.defaultProviderId ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;
  const parallelAgents = wsOverrides?.parallelAgents ?? false;

  useEffect(() => {
    const value = wsOverrides?.defaultBranchPrefix ?? DEFAULT_BRANCH_PREFIX;
    setBranchPrefix(value);
    setSavedBranchPrefix(value);
  }, [isSimple, workspaceId, wsOverrides?.defaultBranchPrefix]);

  const persistOverrides = async (
    partial: Partial<
      Pick<
        OverrideSettings,
        'defaultProviderId' | 'defaultVerbosity' | 'parallelAgents' | 'defaultBranchPrefix'
      >
    >,
  ) => {
    setBusy(true);
    setError(null);
    try {
      await setWorkspaceOverrides(workspaceId, {
        defaultProviderId: wsOverrides?.defaultProviderId ?? null,
        defaultWorkflowId: wsOverrides?.defaultWorkflowId ?? null,
        defaultBranchPrefix: wsOverrides?.defaultBranchPrefix ?? null,
        parallelEnabled: wsOverrides?.parallelEnabled ?? null,
        defaultVerbosity: verbosity,
        providerBindings: wsOverrides?.providerBindings ?? null,
        taskModels: wsOverrides?.taskModels ?? null,
        roleModels: wsOverrides?.roleModels ?? null,
        parallelAgents,
        providerPool: wsOverrides?.providerPool ?? null,
        ...partial,
      });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const commitBranchPrefix = async () => {
    const next = branchPrefix.trim() || DEFAULT_BRANCH_PREFIX;
    setBranchPrefix(next);
    if (next === savedBranchPrefix) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setWorkspaceOverrides(workspaceId, {
        defaultProviderId: wsOverrides?.defaultProviderId ?? null,
        defaultWorkflowId: wsOverrides?.defaultWorkflowId ?? null,
        defaultBranchPrefix: next,
        parallelEnabled: wsOverrides?.parallelEnabled ?? null,
        defaultVerbosity: verbosity,
        providerBindings: wsOverrides?.providerBindings ?? null,
        taskModels: wsOverrides?.taskModels ?? null,
        roleModels: wsOverrides?.roleModels ?? null,
        parallelAgents,
        providerPool: wsOverrides?.providerPool ?? null,
      });
      setSavedBranchPrefix(next);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <div className="flex flex-col divide-y divide-border-soft/50 rounded-lg border border-border-soft/40 bg-subtle/20 px-4">
        {!isSimple ? (
          <FieldRow
            label="Branch prefix"
            help="Prefixes every new session branch, e.g. your initials."
          >
            <div className="flex items-center gap-1.5">
              <GitBranch size={13} aria-hidden className="shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={branchPrefix}
                onChange={(e) => setBranchPrefix(sanitizePrefix(e.target.value))}
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
                aria-label="Branch prefix"
                className={cn(
                  'h-8 rounded-md border border-border bg-background px-2 font-mono text-sm text-foreground motion-safe:transition-colors',
                  'placeholder:text-muted-foreground/40',
                  'hover:border-border-strong focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                  busy && 'cursor-not-allowed opacity-50',
                )}
              />
              <span className="font-mono text-sm text-muted-foreground">/&lt;slug&gt;</span>
            </div>
          </FieldRow>
        ) : null}

        <FieldRow
          label="Default provider"
          help="New sessions start on it and can override it."
          layout="stacked"
        >
          <div className="flex flex-col gap-2.5">
            <ProviderPicker
              connectedProviders={connectedProviderIds}
              provider={defaultProvider}
              disabled={busy}
              onProvider={(providerId) => void persistOverrides({ defaultProviderId: providerId })}
              ariaLabel="Default provider"
            />
            <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-muted-foreground">
              <CONCEPT_ICONS.providers
                size={12}
                aria-hidden
                className="mt-0.5 shrink-0 text-info"
              />
              Goodboy routes work across the providers you connect, by priority and budget.
            </p>
          </div>
        </FieldRow>

        <FieldRow label="Output verbosity" help="How much agents say in their replies.">
          <div className="w-40">
            <VerbositySelect
              value={verbosity as VerbosityLevel}
              onChange={(v) => void persistOverrides({ defaultVerbosity: v })}
              disabled={busy}
            />
          </div>
        </FieldRow>

        {!isSimple ? (
          <FieldRow
            label="Parallel agents"
            help="Allow role-eligible agents to split independent work and merge it coherently."
          >
            <Switch
              label={parallelAgents ? 'On' : 'Off'}
              checked={parallelAgents}
              disabled={busy}
              onChange={(next) => void persistOverrides({ parallelAgents: next })}
            />
          </FieldRow>
        ) : null}
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
};
