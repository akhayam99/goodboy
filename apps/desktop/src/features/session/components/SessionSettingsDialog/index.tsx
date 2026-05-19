import { useEffect, useState } from 'react';
import { Button, Dialog, Input, cn } from '@kay-am/ui';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Bot,
  DollarSign,
  GitBranch,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { SessionId } from '@kay-am/types';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';
import { SESSION_FEATURES, WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { parseCap } from '../../../../shared/lib/parse-cap';
import { listLocalBranches, type LocalBranchInfo } from '../../../../features/worktree/worktree';
import { useToast } from '../../../../app/components/Toast';

interface SessionSettingsDialogProps {
  sessionId: SessionId;
  open: boolean;
  onClose: () => void;
  archived: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
}

type Section = 'general' | 'budget' | 'danger';

interface NavItem {
  id: Section;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'general', label: 'General', icon: <Bot size={14} aria-hidden /> },
  ...(SESSION_FEATURES.budget
    ? [{ id: 'budget' as const, label: 'Budget', icon: <DollarSign size={14} aria-hidden /> }]
    : []),
];

const DANGER_NAV: NavItem = {
  id: 'danger',
  label: 'Delete',
  icon: <Trash2 size={14} aria-hidden />,
};

export function SessionSettingsDialog({
  sessionId,
  open,
  onClose,
  archived,
  onArchive,
  onUnarchive,
}: SessionSettingsDialogProps) {
  const session = useAppStore((s) => s.sessions.find((x) => x.id === sessionId) ?? null);
  const branch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const sessionBranches = useAppStore((s) => s.sessionBranches);
  const budget = useAppStore((s) => s.sessionBudgets[sessionId] ?? null);
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const loadSessionBudget = useAppStore((s) => s.loadSessionBudget);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const renameTask = useAppStore((s) => s.renameTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const changeSessionBranch = useAppStore((s) => s.changeSessionBranch);
  const workspace = useAppStore((s) =>
    session ? (s.workspaces.find((w) => w.id === session.workspaceId) ?? null) : null,
  );
  const hasInitScript = useAppStore((s) =>
    session ? s.workspaceInitScripts[session.workspaceId] != null : false,
  );
  const updateSessionSkipInit = useAppStore((s) => s.updateSessionSkipInit);
  const { showToast } = useToast();

  const [active, setActive] = useState<Section>('general');
  const [goalDraft, setGoalDraft] = useState('');
  const [capDraft, setCapDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [branchEditOpen, setBranchEditOpen] = useState(false);
  const [branchMode, setBranchMode] = useState<'existing' | 'new'>('existing');
  const [branchTarget, setBranchTarget] = useState('');
  const [branches, setBranches] = useState<ReadonlyArray<LocalBranchInfo>>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [confirmReuse, setConfirmReuse] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActive('general');
    setError(null);
    setBusy(false);
    setConfirmDelete(false);
    setBranchEditOpen(false);
    void loadSessionBudget(sessionId);
  }, [open, sessionId, loadSessionBudget]);

  useEffect(() => {
    if (!branchEditOpen || !workspace?.rootPath) return;
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

  if (!session) return null;

  const isActiveSession = sessionSummary !== null;
  const spent = isActiveSession ? (sessionSummary?.estimatedCostUsd ?? 0) : 0;

  const onSaveGoal = async () => {
    const trimmed = goalDraft.trim();
    if (!trimmed) {
      setError('goal cannot be empty');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await renameTask(sessionId, trimmed);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const onSaveCap = async () => {
    const parsed = parseCap(capDraft);
    if (parsed === null) {
      setError('cap must be a positive number');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setSessionBudget(sessionId, parsed);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const targetTrimmed = branchTarget.trim();
  const targetInfo = branches.find((b) => b.name === targetTrimmed) ?? null;
  // Friction sources: branch already owned by another session, branch in use
  // in another worktree, branch has uncommitted work in its current worktree.
  const targetOwnedByOtherSession = Object.entries(sessionBranches).some(
    ([otherSessionId, b]) => otherSessionId !== sessionId && b === targetTrimmed,
  );
  const targetInUseElsewhere = targetInfo?.inUse === true;
  const targetDirty = targetInfo?.hasUncommitted === true;
  const targetNeedsConfirm =
    branchMode === 'existing' && (targetOwnedByOtherSession || targetInUseElsewhere || targetDirty);

  const onChangeBranch = async () => {
    if (!targetTrimmed) {
      setError('branch is required');
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

  const renderContent = () => {
    switch (active) {
      case 'general':
        return (
          <div className="flex flex-col gap-4">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground">Session</div>
            <Field
              label="name"
              hint="display name for the session in the sidebar. to update the actual goal text the agent reads, use the context panel on the right."
            >
              <div className="flex gap-2">
                <Input
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  placeholder="refactor auth domain"
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={() => void onSaveGoal()}
                  disabled={busy || goalDraft.trim() === session.goal.trim()}
                >
                  Save
                </Button>
              </div>
            </Field>
            <Field
              label="branch"
              hint="switch this session to a different branch. existing checkouts with uncommitted work require confirmation."
            >
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-md bg-subtle px-2.5 py-2 text-xs text-muted-foreground ring-1 ring-border-soft">
                  <GitBranch size={12} aria-hidden />
                  <code className="font-mono text-foreground">{branch ?? 'unknown'}</code>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setBranchEditOpen(true)}
                  disabled={busy || !workspace}
                >
                  Change branch
                </Button>
              </div>
            </Field>
            <Field label="provider" hint="set at creation time.">
              <span className="inline-flex w-fit items-center gap-2 rounded-md bg-subtle px-2.5 py-1.5 text-xs text-muted-foreground ring-1 ring-border-soft">
                {session.providerPreference.defaultProvider}
              </span>
            </Field>
            {WORKSPACE_FEATURES.initScript && hasInitScript ? (
              <Field
                label="init script"
                hint="when enabled, a setup agent runs the workspace init script before the first agent fires."
              >
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={!session.skipInit}
                    onChange={(e) => void updateSessionSkipInit(sessionId, !e.target.checked)}
                    className="accent-primary"
                  />
                  run workspace init script
                </label>
              </Field>
            ) : null}
          </div>
        );

      case 'budget':
        return (
          <div className="flex flex-col gap-4">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground">
              Soft cap
            </div>
            <Field
              label="cap (usd)"
              hint="warning fires at 80%, error at 100%. session keeps running unless you stop it."
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
                />
                <Button variant="secondary" onClick={() => void onSaveCap()} disabled={busy}>
                  Save
                </Button>
              </div>
            </Field>
            {budget?.softCapUsd != null ? (
              <div className="rounded-md bg-subtle p-3 text-xs text-muted-foreground ring-1 ring-border-soft">
                <div className="flex items-center justify-between">
                  <span>spent this session</span>
                  <span className="font-mono text-foreground">
                    ${spent.toFixed(2)} / ${budget.softCapUsd.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        );

      case 'danger':
        return (
          <div className="flex flex-col gap-5">
            <div>
              <div className="text-xs font-semibold tracking-wide text-danger">Danger zone</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                permanent actions on this session.
              </p>
            </div>

            {/* Archive row */}
            <div className="flex items-start justify-between gap-4 rounded-md border border-border-soft p-3">
              <div className="flex-1">
                <div className="text-xs font-semibold text-foreground">
                  {archived ? 'unarchive' : 'archive'}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {archived
                    ? 'restore this session to the active list.'
                    : 'hide from the active list, keep history. reversible.'}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  archived ? onUnarchive() : onArchive();
                  onClose();
                }}
                disabled={busy}
              >
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
            </div>

            {/* Delete row */}
            <div
              className={cn(
                'flex flex-col gap-3 rounded-md border p-3 transition-colors',
                confirmDelete ? 'border-danger/40 bg-danger/5' : 'border-border-soft',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-foreground">delete session</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    removes worktree, transcripts, audit logs, and the branch. cannot be undone.
                  </p>
                </div>
                {!confirmDelete ? (
                  <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                    <Trash2 size={13} aria-hidden className="mr-1.5" />
                    Delete
                  </Button>
                ) : null}
              </div>

              {confirmDelete ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-warning">
                    <Archive size={13} aria-hidden />
                    <span>consider archiving instead. keeps history and is reversible.</span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
                      Cancel
                    </Button>
                    {!archived ? (
                      <Button
                        variant="warning"
                        onClick={() => {
                          onArchive();
                          setConfirmDelete(false);
                          onClose();
                        }}
                        disabled={busy}
                      >
                        <Archive size={13} aria-hidden className="mr-1.5" />
                        Archive instead
                      </Button>
                    ) : null}
                    <Button variant="danger" onClick={() => void onDelete()} disabled={busy}>
                      {busy ? 'Deleting…' : 'Confirm delete'}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={session.goal}
        description="rename, edit budget, or delete this session."
        size="xl"
        fixedHeightClass="h-[520px]"
        fullScreenOnSmall
        footer={
          <>
            {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </>
        }
      >
        <div className="flex h-full min-h-0 gap-0">
          <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto pr-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                className={`relative flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-left text-sm transition-colors ${
                  active === item.id
                    ? 'bg-muted font-medium text-foreground before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
            <div className="mt-auto pt-3">
              <button
                type="button"
                onClick={() => setActive('danger')}
                className={`relative flex w-full items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-left text-sm transition-colors ${
                  active === 'danger'
                    ? 'bg-danger/15 font-medium text-danger before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-danger'
                    : 'text-danger/80 hover:bg-danger/10 hover:text-danger'
                }`}
              >
                {DANGER_NAV.icon}
                <span>{DANGER_NAV.label}</span>
              </button>
            </div>
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto pl-4">{renderContent()}</div>
        </div>
      </Dialog>
      <Dialog
        open={branchEditOpen}
        onClose={() => setBranchEditOpen(false)}
        title="Change session branch"
        description="point this session's worktree at a different branch."
        size="md"
        footer={
          <>
            {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
            <Button variant="ghost" onClick={() => setBranchEditOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void onChangeBranch()}
              disabled={busy || branchesLoading || targetTrimmed.length === 0}
              variant={targetNeedsConfirm && confirmReuse ? 'warning' : 'primary'}
            >
              {busy ? (
                <>
                  <Loader2 size={13} className="mr-1.5 animate-spin" aria-hidden />
                  Switching…
                </>
              ) : targetNeedsConfirm && confirmReuse ? (
                'Confirm switch'
              ) : (
                'Switch branch'
              )}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div
            role="tablist"
            aria-label="branch source"
            className="inline-flex rounded-md border border-border bg-subtle p-0.5"
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
                    'rounded px-3 py-1 text-xs font-medium motion-safe:transition-colors',
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m === 'existing' ? 'existing branch' : 'new branch'}
                </button>
              );
            })}
          </div>

          {branchMode === 'existing' ? (
            <Field label="branch" hint="pick from local branches in this workspace.">
              <select
                value={branchTarget}
                onChange={(e) => {
                  setBranchTarget(e.target.value);
                  setConfirmReuse(false);
                }}
                disabled={busy || branchesLoading}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm motion-safe:transition-colors hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">
                  {branchesLoading
                    ? 'loading…'
                    : branches.length === 0
                      ? 'no local branches'
                      : 'select branch…'}
                </option>
                {branches
                  .filter((b) => b.name !== branch)
                  .map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                      {b.inUse ? ' · in use' : ''}
                      {b.hasUncommitted ? ' · dirty' : ''}
                    </option>
                  ))}
              </select>
            </Field>
          ) : (
            <Field
              label="new branch name"
              hint="creates and switches to a new branch from current HEAD."
            >
              <Input
                value={branchTarget}
                onChange={(e) => {
                  setBranchTarget(e.target.value);
                  setConfirmReuse(false);
                }}
                placeholder="feat/something"
                disabled={busy}
              />
            </Field>
          )}

          {targetNeedsConfirm ? (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
              <AlertTriangle size={13} aria-hidden className="mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold">heads up</span>
                <ul className="list-disc pl-4">
                  {targetOwnedByOtherSession ? (
                    <li>this branch is already attached to another kay-am session.</li>
                  ) : null}
                  {targetInUseElsewhere ? (
                    <li>this branch is checked out in another git worktree.</li>
                  ) : null}
                  {targetDirty ? <li>that worktree has uncommitted changes.</li> : null}
                </ul>
                <span className="text-2xs text-warning/80">click again to confirm.</span>
              </div>
            </div>
          ) : null}
        </div>
      </Dialog>
    </>
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
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
