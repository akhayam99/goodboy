import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, FieldRow, Input, cn } from '@goodboy/ui';
import { AlertTriangle, ChevronDown, ChevronUp, GitBranch, Loader2 } from 'lucide-react';
import type { ProviderId, SessionId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore, useSessionById } from '../../../../store';
import { SESSION_FEATURES } from '../../../../shared/lib/features';
import { parseCap } from '../../../../shared/lib/parse-cap';
import { listLocalBranches, type LocalBranchInfo } from '../../../../features/worktree/worktree';
import { BranchCombobox } from '../../../../features/worktree/BranchCombobox';
import { useToast } from '../../../../app/components/Toast';
import { PROVIDER_LABEL } from '../../../../features/chat/utils/chat-constants';
import { ProviderChip } from '../../../../features/providers/components/ProviderChip';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionScopePanel = ({ sessionId }: Props) => {
  const session = useSessionById(sessionId);
  const branch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const sessionBranches = useAppStore((s) => s.sessionBranches);
  const budget = useAppStore((s) => s.sessionBudgets[sessionId] ?? null);
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const loadSessionBudget = useAppStore((s) => s.loadSessionBudget);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const setSessionConfig = useAppStore((s) => s.setSessionConfig);
  const connectedProviderIds = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );
  const changeSessionBranch = useAppStore((s) => s.changeSessionBranch);
  const workspace = useAppStore((s) =>
    session ? (s.workspaces.find((w) => w.id === session.workspaceId) ?? null) : null,
  );
  const { showToast } = useToast();

  const [capDraft, setCapDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [branchEditOpen, setBranchEditOpen] = useState(false);
  const [branchMode, setBranchMode] = useState<'existing' | 'new'>('existing');
  const [branchTarget, setBranchTarget] = useState('');
  const [branches, setBranches] = useState<ReadonlyArray<LocalBranchInfo>>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [confirmReuse, setConfirmReuse] = useState(false);

  useEffect(() => {
    void loadSessionBudget(sessionId);
  }, [sessionId, loadSessionBudget]);

  useEffect(() => {
    if (!branchEditOpen || !workspace?.rootPath) {
      return;
    }
    setBranchesLoading(true);
    setConfirmReuse(false);
    setBranchTarget('');
    listLocalBranches(workspace.rootPath)
      .then(setBranches)
      .catch(() => setBranches([]))
      .finally(() => setBranchesLoading(false));
  }, [branchEditOpen, workspace?.rootPath]);

  useEffect(() => {
    setCapDraft(budget?.softCapUsd != null ? String(budget.softCapUsd) : '');
  }, [budget?.softCapUsd]);

  if (!session) {
    return null;
  }

  const isActiveSession = sessionSummary !== null;
  const spent = isActiveSession ? (sessionSummary?.estimatedCostUsd ?? 0) : 0;
  const currentProvider = session.providerPreference.defaultProvider;

  const onSaveCap = async () => {
    const parsed = parseCap(capDraft);
    if (parsed === null) {
      setError('Cap must be a positive number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setSessionBudget(sessionId, parsed);
      showToast('success', 'budget updated');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const targetTrimmed = branchTarget.trim();
  const targetInfo = branches.find((b) => b.name === targetTrimmed) ?? null;
  const targetOwnedByOtherSession = Object.entries(sessionBranches).some(
    ([otherSessionId, b]) => otherSessionId !== sessionId && b === targetTrimmed,
  );
  const targetInUseElsewhere = targetInfo?.inUse === true;
  const targetDirty = targetInfo?.hasUncommitted === true;
  const targetNeedsConfirm =
    branchMode === 'existing' && (targetOwnedByOtherSession || targetInUseElsewhere || targetDirty);

  const onChangeBranch = async () => {
    if (!targetTrimmed) {
      setError('Pick a branch.');
      return;
    }
    if (targetTrimmed === branch) {
      setBranchEditOpen(false);
      return;
    }
    if (targetNeedsConfirm && !confirmReuse) {
      setConfirmReuse(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changeSessionBranch(sessionId, {
        branch: targetTrimmed,
        createNew: branchMode === 'new',
      });
      showToast('success', `branch switched to ${targetTrimmed}`);
      setBranchEditOpen(false);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const onChangeProvider = async (next: ProviderId) => {
    if (next === session.providerPreference.defaultProvider) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setSessionConfig(sessionId, { defaultProvider: next });
      showToast('success', `default provider set to ${PROVIDER_LABEL[next] ?? next}`);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const onToggleEnabledProvider = async (next: ProviderId) => {
    const pref = session.providerPreference;
    if (next === pref.defaultProvider) {
      return;
    }
    const effective = new Set<ProviderId>(pref.enabledProviders ?? connectedProviderIds);
    if (effective.has(next)) {
      effective.delete(next);
    } else {
      effective.add(next);
    }
    effective.add(pref.defaultProvider);
    const selected = connectedProviderIds.filter((p) => effective.has(p));
    const allEnabled = selected.length === connectedProviderIds.length;
    setBusy(true);
    setError(null);
    try {
      await setSessionConfig(sessionId, { enabledProviders: allEnabled ? null : selected });
      showToast('success', 'routing providers updated');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto px-8 py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <div className="flex flex-col divide-y divide-border-soft/50">
          <FieldRow label="Branch" help="Worktree branch this session runs on." layout="stacked">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate font-mono text-xs text-foreground">
                  <GitBranch size={11} aria-hidden className="shrink-0 text-muted-foreground" />
                  <span className="truncate">{branch ?? 'unknown'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setBranchEditOpen(!branchEditOpen)}
                  disabled={busy || !workspace}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
                    (busy || !workspace) && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {branchEditOpen ? (
                    <ChevronUp size={12} aria-hidden />
                  ) : (
                    <ChevronDown size={12} aria-hidden />
                  )}
                  {branchEditOpen ? 'Cancel' : 'Change…'}
                </button>
              </div>

              {branchEditOpen ? (
                <div className="flex flex-col gap-3">
                  <div
                    role="tablist"
                    aria-label="branch source"
                    className="inline-flex w-fit rounded-md bg-muted/40 p-0.5"
                  >
                    {(['existing', 'new'] as const).map((m) => {
                      const active = branchMode === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => {
                            setBranchMode(m);
                            setBranchTarget('');
                            setConfirmReuse(false);
                          }}
                          disabled={busy}
                          className={cn(
                            'rounded px-2.5 py-0.5 text-2xs font-medium motion-safe:transition-colors',
                            active
                              ? 'bg-background text-primary shadow-sm'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {m === 'existing' ? 'pick existing' : 'create new'}
                        </button>
                      );
                    })}
                  </div>

                  {branchMode === 'existing' ? (
                    <BranchCombobox
                      branches={branches}
                      value={branchTarget}
                      onChange={(v) => {
                        setBranchTarget(v);
                        setConfirmReuse(false);
                      }}
                      disabled={busy}
                      loading={branchesLoading}
                      excludeNames={branch ? [branch] : undefined}
                    />
                  ) : (
                    <Input
                      value={branchTarget}
                      onChange={(e) => {
                        setBranchTarget(e.target.value);
                        setConfirmReuse(false);
                      }}
                      placeholder="feat/something"
                      disabled={busy}
                      className="font-mono"
                    />
                  )}

                  {targetNeedsConfirm ? (
                    <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-xs">
                      <AlertTriangle
                        size={13}
                        aria-hidden
                        className="mt-0.5 shrink-0 text-warning"
                      />
                      <div className="flex flex-col gap-1">
                        <ul className="list-disc pl-4 text-muted-foreground">
                          {targetOwnedByOtherSession ? (
                            <li>Already attached to another session.</li>
                          ) : null}
                          {targetInUseElsewhere ? (
                            <li>Checked out in another git worktree.</li>
                          ) : null}
                          {targetDirty ? <li>That worktree has uncommitted changes.</li> : null}
                        </ul>
                        <span className="text-2xs text-warning/80">
                          Click {confirmReuse ? '"Confirm switch"' : '"Switch branch"'} again to
                          confirm.
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-end">
                    <Button
                      size="sm"
                      onClick={() => void onChangeBranch()}
                      disabled={busy || branchesLoading || branchTarget.trim().length === 0}
                      variant={targetNeedsConfirm && confirmReuse ? 'warning' : 'primary'}
                    >
                      {busy ? (
                        <>
                          <Loader2 size={12} className="mr-1.5 animate-spin" aria-hidden />
                          Switching…
                        </>
                      ) : targetNeedsConfirm && confirmReuse ? (
                        'Confirm switch'
                      ) : (
                        'Switch branch'
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </FieldRow>

          <FieldRow label="Default provider" help="Runs new agents and workflow steps.">
            <div className="flex flex-wrap justify-end gap-1">
              {SESSION_PROVIDER_OPTIONS.map((id) => (
                <ProviderChip
                  key={id}
                  id={id}
                  selected={currentProvider === id}
                  disabled={busy}
                  onClick={() => void onChangeProvider(id)}
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

          <FieldRow
            label="Routing pool"
            help="Fallbacks when the default is over budget or offline."
          >
            {connectedProviderIds.length === 0 ? (
              <span className="text-2xs text-muted-foreground">No providers connected.</span>
            ) : (
              <div className="flex flex-wrap justify-end gap-1">
                {connectedProviderIds.map((id) => {
                  const enabled = (
                    session.providerPreference.enabledProviders ?? connectedProviderIds
                  ).includes(id);
                  const isDefault = id === currentProvider;
                  return (
                    <ProviderChip
                      key={id}
                      id={id}
                      selected={enabled}
                      disabled={busy || isDefault}
                      onClick={() => void onToggleEnabledProvider(id)}
                      title={isDefault ? 'default provider is always enabled' : undefined}
                      trailing={
                        isDefault ? (
                          <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70">
                            default
                          </span>
                        ) : null
                      }
                    />
                  );
                })}
              </div>
            )}
          </FieldRow>

          {SESSION_FEATURES.budget ? (
            <FieldRow
              label="Budget cap"
              help="Optional ceiling in USD. Warns at 80%, errors at 100%."
              layout="stacked"
            >
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={capDraft}
                  onChange={(e) => setCapDraft(e.target.value)}
                  placeholder="2.50"
                  className="flex-1"
                  disabled={busy}
                />
                <Button variant="secondary" onClick={() => void onSaveCap()} disabled={busy}>
                  Save
                </Button>
              </div>
              {budget?.softCapUsd != null && budget.softCapUsd > 0 ? (
                <CapProgress spent={spent} softCapUsd={budget.softCapUsd} />
              ) : null}
            </FieldRow>
          ) : null}
        </div>

        {error ? <p className="pt-4 text-xs text-danger">{error}</p> : null}
      </div>
    </div>
  );
};

const SESSION_PROVIDER_OPTIONS: ReadonlyArray<ProviderId> = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
];

function CapProgress({ spent, softCapUsd }: { spent: number; softCapUsd: number }) {
  const pct = softCapUsd > 0 ? Math.min(1, spent / softCapUsd) : 0;
  const barTone =
    pct >= 1 ? 'bg-danger' : pct >= 0.8 ? 'bg-warning' : pct >= 0.5 ? 'bg-info' : 'bg-success';
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Spent this session</span>
        <span className="font-mono text-foreground">
          ${spent.toFixed(2)} / ${softCapUsd.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn('h-full rounded-full transition-all', barTone)}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-2xs text-muted-foreground/70">
        <span>{Math.round(pct * 100)}% used</span>
        {pct >= 0.8 ? (
          <span className={pct >= 1 ? 'text-danger' : 'text-warning'}>
            {pct >= 1 ? 'cap exceeded' : 'approaching cap'}
          </span>
        ) : null}
      </div>
    </div>
  );
}
