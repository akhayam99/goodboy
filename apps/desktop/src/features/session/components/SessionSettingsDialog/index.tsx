import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Dialog, DialogSectionHeader, Divider, Input, cn } from '@goodboy/ui';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  DollarSign,
  GitBranch,
  Loader2,
  Settings2,
  Trash2,
  Zap,
} from 'lucide-react';
import type { ProviderId, SessionId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore, useSessionById } from '../../../../store';
import { SESSION_FEATURES } from '../../../../shared/lib/features';
import { parseCap } from '../../../../shared/lib/parse-cap';
import { listLocalBranches, type LocalBranchInfo } from '../../../../features/worktree/worktree';
import { BranchCombobox } from '../../../../features/worktree/BranchCombobox';
import { useToast } from '../../../../app/components/Toast';
import { PROVIDER_LABEL } from '../../../../features/chat/utils/chat-constants';

type SessionSettingsDialogProps = {
  sessionId: SessionId;
  open: boolean;
  onClose: () => void;
  archived: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
};

const DELETE_ARM_TIMEOUT_MS = 4000;

export const SessionSettingsDialog = ({
  sessionId,
  open,
  onClose,
  archived,
  onArchive,
  onUnarchive,
}: SessionSettingsDialogProps) => {
  const session = useSessionById(sessionId);
  const branch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const sessionBranches = useAppStore((s) => s.sessionBranches);
  const budget = useAppStore((s) => s.sessionBudgets[sessionId] ?? null);
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const loadSessionBudget = useAppStore((s) => s.loadSessionBudget);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const setSessionConfig = useAppStore((s) => s.setSessionConfig);
  const renameTask = useAppStore((s) => s.renameTask);
  const connectedProviderIds = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );
  const deleteTask = useAppStore((s) => s.deleteTask);
  const changeSessionBranch = useAppStore((s) => s.changeSessionBranch);
  const workspace = useAppStore((s) =>
    session ? (s.workspaces.find((w) => w.id === session.workspaceId) ?? null) : null,
  );
  const { showToast } = useToast();

  const [goalDraft, setGoalDraft] = useState('');
  const [capDraft, setCapDraft] = useState('');
  const [deleteArmed, setDeleteArmed] = useState(false);
  const deleteArmTimer = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [branchEditOpen, setBranchEditOpen] = useState(false);
  const [branchMode, setBranchMode] = useState<'existing' | 'new'>('existing');
  const [branchTarget, setBranchTarget] = useState('');
  const [branches, setBranches] = useState<ReadonlyArray<LocalBranchInfo>>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [confirmReuse, setConfirmReuse] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setBusy(false);
    setDeleteArmed(false);
    setBranchEditOpen(false);
    void loadSessionBudget(sessionId);
  }, [open, sessionId, loadSessionBudget]);

  useEffect(() => {
    return () => {
      if (deleteArmTimer.current !== null) {
        window.clearTimeout(deleteArmTimer.current);
        deleteArmTimer.current = null;
      }
    };
  }, []);

  const armDelete = () => {
    setDeleteArmed(true);
    if (deleteArmTimer.current !== null) {
      window.clearTimeout(deleteArmTimer.current);
    }
    deleteArmTimer.current = window.setTimeout(() => {
      setDeleteArmed(false);
      deleteArmTimer.current = null;
    }, DELETE_ARM_TIMEOUT_MS);
  };

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
    setGoalDraft(session?.goal ?? '');
  }, [session?.goal]);

  useEffect(() => {
    setCapDraft(budget?.softCapUsd != null ? String(budget.softCapUsd) : '');
  }, [budget?.softCapUsd]);

  if (!session) {
    return null;
  }

  const isActiveSession = sessionSummary !== null;
  const spent = isActiveSession ? (sessionSummary?.estimatedCostUsd ?? 0) : 0;

  const onSaveGoal = async () => {
    const trimmed = goalDraft.trim();
    if (!trimmed) {
      setError('Name cannot be empty.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await renameTask(sessionId, trimmed);
      showToast('success', 'session renamed');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

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

  const onDeleteClick = () => {
    if (!deleteArmed) {
      armDelete();
      return;
    }
    if (deleteArmTimer.current !== null) {
      window.clearTimeout(deleteArmTimer.current);
      deleteArmTimer.current = null;
    }
    void onDelete();
  };

  const onArchiveClick = () => {
    if (deleteArmTimer.current !== null) {
      window.clearTimeout(deleteArmTimer.current);
      deleteArmTimer.current = null;
    }
    setDeleteArmed(false);
    if (archived) {
      onUnarchive();
    } else {
      onArchive();
    }
    onClose();
  };

  const onChangeProvider = async (next: ProviderId) => {
    if (next === session?.providerPreference.defaultProvider) {
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

  const onDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteTask(sessionId);
      onClose();
    } catch (err) {
      setError(formatError(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Session settings"
      description={session.goal}
      size="xl"
      className="w-[56rem] max-w-[95vw]"
      bodyClassName="px-0 py-0 gap-0"
      fullScreenOnSmall
      footer={
        <div className="flex w-full items-center gap-2">
          <Button
            variant={deleteArmed ? 'danger' : 'ghost'}
            onClick={onDeleteClick}
            disabled={busy}
            className={cn(
              'relative gap-1.5 overflow-hidden',
              !deleteArmed && 'text-danger/80 hover:bg-danger/10 hover:text-danger',
            )}
            title={
              deleteArmed
                ? 'click again to confirm, this cannot be undone'
                : 'delete session (worktree, transcripts). branch preserved'
            }
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : deleteArmed ? (
              <AlertTriangle size={13} aria-hidden />
            ) : (
              <Trash2 size={13} aria-hidden />
            )}
            {deleteArmed ? 'Click again to confirm' : 'Delete'}
            {deleteArmed ? (
              <span
                aria-hidden
                className="shrink-bar absolute inset-x-0 bottom-0 h-0.5 bg-danger-foreground/70"
                style={{ '--shrink-duration': `${DELETE_ARM_TIMEOUT_MS}ms` } as CSSProperties}
              />
            ) : null}
          </Button>
          {deleteArmed && !archived ? (
            <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <Archive size={11} aria-hidden className="text-warning" />
              not sure? archive instead, reversible, keeps history.
            </span>
          ) : (
            <div className="flex-1">
              {error ? <span className="text-xs text-danger">{error}</span> : null}
            </div>
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onArchiveClick} disabled={busy}>
            {archived ? (
              <>
                <ArchiveRestore size={13} aria-hidden className="mr-1.5" />
                Unarchive
              </>
            ) : (
              <>
                <Archive size={13} aria-hidden className="mr-1.5" />
                Archive
              </>
            )}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col overflow-y-auto px-8 py-6">
        <GeneralSection
          session={session}
          goalDraft={goalDraft}
          setGoalDraft={setGoalDraft}
          onSaveGoal={onSaveGoal}
          branch={branch}
          workspaceReady={!!workspace}
          busy={busy}
          connectedProviderIds={connectedProviderIds}
          onChangeProvider={(p) => void onChangeProvider(p)}
          branchEditOpen={branchEditOpen}
          setBranchEditOpen={setBranchEditOpen}
          branchMode={branchMode}
          setBranchMode={(m) => {
            setBranchMode(m);
            setBranchTarget('');
            setConfirmReuse(false);
          }}
          branchTarget={branchTarget}
          setBranchTarget={(v) => {
            setBranchTarget(v);
            setConfirmReuse(false);
          }}
          branches={branches}
          branchesLoading={branchesLoading}
          targetNeedsConfirm={targetNeedsConfirm}
          targetOwnedByOtherSession={targetOwnedByOtherSession}
          targetInUseElsewhere={targetInUseElsewhere}
          targetDirty={targetDirty}
          confirmReuse={confirmReuse}
          onChangeBranch={onChangeBranch}
        />
        {SESSION_FEATURES.budget ? (
          <>
            <div className="my-6">
              <Divider />
            </div>
            <BudgetSection
              capDraft={capDraft}
              setCapDraft={setCapDraft}
              onSaveCap={onSaveCap}
              busy={busy}
              softCapUsd={budget?.softCapUsd ?? null}
              spent={spent}
            />
          </>
        ) : null}
      </div>
    </Dialog>
  );
};

type GeneralSectionProps = {
  readonly session: { goal: string; providerPreference: { defaultProvider: ProviderId } };
  readonly goalDraft: string;
  readonly setGoalDraft: (v: string) => void;
  readonly onSaveGoal: () => void;
  readonly branch: string | null;
  readonly workspaceReady: boolean;
  readonly busy: boolean;
  readonly connectedProviderIds: ReadonlyArray<ProviderId>;
  readonly onChangeProvider: (p: ProviderId) => void;
  readonly branchEditOpen: boolean;
  readonly setBranchEditOpen: (v: boolean) => void;
  readonly branchMode: 'existing' | 'new';
  readonly setBranchMode: (m: 'existing' | 'new') => void;
  readonly branchTarget: string;
  readonly setBranchTarget: (v: string) => void;
  readonly branches: ReadonlyArray<LocalBranchInfo>;
  readonly branchesLoading: boolean;
  readonly targetNeedsConfirm: boolean;
  readonly targetOwnedByOtherSession: boolean;
  readonly targetInUseElsewhere: boolean;
  readonly targetDirty: boolean;
  readonly confirmReuse: boolean;
  readonly onChangeBranch: () => void;
};

function GeneralSection(props: GeneralSectionProps) {
  const {
    session,
    goalDraft,
    setGoalDraft,
    onSaveGoal,
    branch,
    workspaceReady,
    busy,
    connectedProviderIds,
    onChangeProvider,
    branchEditOpen,
    setBranchEditOpen,
    branchMode,
    setBranchMode,
    branchTarget,
    setBranchTarget,
    branches,
    branchesLoading,
    targetNeedsConfirm,
    targetOwnedByOtherSession,
    targetInUseElsewhere,
    targetDirty,
    confirmReuse,
    onChangeBranch,
  } = props;

  const currentProvider = session.providerPreference.defaultProvider;

  return (
    <div className="flex flex-col gap-7">
      <DialogSectionHeader
        icon={<Settings2 size={14} aria-hidden className="text-primary" />}
        title="General"
        description="Identity and infrastructure for this session. The goal text the agent actually reads lives in the right-hand context panel."
      />

      <Field
        label="Name"
        hint="Display name in the sidebar. Renaming doesn't change what the agent sees."
      >
        <div className="flex gap-2">
          <Input
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            placeholder="e.g. refactor auth domain"
            disabled={busy}
            className="flex-1"
          />
          <Button
            variant="secondary"
            onClick={onSaveGoal}
            disabled={busy || goalDraft.trim() === session.goal.trim() || goalDraft.trim() === ''}
          >
            Save
          </Button>
        </div>
      </Field>

      <Field
        label="Branch"
        hint="Switch this session to a different branch. Existing checkouts with uncommitted work require confirmation."
      >
        <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/50 p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex flex-1 items-center gap-1.5 truncate rounded-md border border-border-soft bg-background px-2.5 py-1.5 font-mono text-xs text-foreground">
              <GitBranch size={11} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="truncate">{branch ?? 'unknown'}</span>
            </span>
            <button
              type="button"
              onClick={() => setBranchEditOpen(!branchEditOpen)}
              disabled={busy || !workspaceReady}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border border-border-soft bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-border hover:bg-muted/50',
                (busy || !workspaceReady) && 'cursor-not-allowed opacity-50',
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
            <div className="flex flex-col gap-3 border-t border-border-soft pt-3">
              <div
                role="tablist"
                aria-label="branch source"
                className="inline-flex w-fit rounded-md border border-border bg-background p-0.5"
              >
                {(['existing', 'new'] as const).map((m) => {
                  const active = branchMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setBranchMode(m)}
                      disabled={busy}
                      className={cn(
                        'rounded px-2.5 py-0.5 text-2xs font-medium motion-safe:transition-colors',
                        active
                          ? 'bg-primary/10 text-primary'
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
                  onChange={setBranchTarget}
                  disabled={busy}
                  loading={branchesLoading}
                  excludeNames={branch ? [branch] : undefined}
                />
              ) : (
                <Input
                  value={branchTarget}
                  onChange={(e) => setBranchTarget(e.target.value)}
                  placeholder="feat/something"
                  disabled={busy}
                  className="font-mono"
                />
              )}

              {targetNeedsConfirm ? (
                <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
                  <AlertTriangle size={13} aria-hidden className="mt-0.5 shrink-0 text-warning" />
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-foreground">Heads up</span>
                    <ul className="list-disc pl-4 text-muted-foreground">
                      {targetOwnedByOtherSession ? (
                        <li>Already attached to another session.</li>
                      ) : null}
                      {targetInUseElsewhere ? <li>Checked out in another git worktree.</li> : null}
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
                  onClick={onChangeBranch}
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
      </Field>

      <Field
        label="Provider"
        hint="Default provider for new agents and workflows spawned in this session. Inherited from the workspace at creation; per-turn overrides still happen in the chat composer."
      >
        <SessionProviderPicker
          value={currentProvider}
          onChange={onChangeProvider}
          connected={connectedProviderIds}
          disabled={busy}
        />
      </Field>
    </div>
  );
}

const SESSION_PROVIDER_OPTIONS: ReadonlyArray<ProviderId> = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
];

function SessionProviderPicker({
  value,
  onChange,
  connected,
  disabled,
}: {
  value: ProviderId;
  onChange: (p: ProviderId) => void;
  connected: ReadonlyArray<ProviderId>;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SESSION_PROVIDER_OPTIONS.map((id) => {
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
            <Zap size={11} aria-hidden />
            {PROVIDER_LABEL[id]}
            {!isConnected && (
              <span className="text-[9px] uppercase tracking-wide text-warning">offline</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type BudgetSectionProps = {
  readonly capDraft: string;
  readonly setCapDraft: (v: string) => void;
  readonly onSaveCap: () => void;
  readonly busy: boolean;
  readonly softCapUsd: number | null;
  readonly spent: number;
};

function BudgetSection({
  capDraft,
  setCapDraft,
  onSaveCap,
  busy,
  softCapUsd,
  spent,
}: BudgetSectionProps) {
  const pct = softCapUsd && softCapUsd > 0 ? Math.min(1, spent / softCapUsd) : 0;
  const barTone =
    pct >= 1 ? 'bg-danger' : pct >= 0.8 ? 'bg-warning' : pct >= 0.5 ? 'bg-info' : 'bg-success';
  return (
    <div className="flex flex-col gap-7">
      <DialogSectionHeader
        icon={<DollarSign size={14} aria-hidden className="text-primary" />}
        title="Budget"
        description="Optional spend ceiling. Warning at 80%, error at 100%. The session keeps running unless you stop it."
      />
      <Field label="Soft cap (USD)" hint="Leave blank to skip. Increments allowed in cents.">
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
          <Button variant="secondary" onClick={onSaveCap} disabled={busy}>
            Save
          </Button>
        </div>
      </Field>
      {softCapUsd != null && softCapUsd > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-subtle/50 p-4">
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
            {pct >= 0.8 && (
              <span className={pct >= 1 ? 'text-danger' : 'text-warning'}>
                {pct >= 1 ? 'cap exceeded' : 'approaching cap'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {hint ? <p className="text-2xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}
