import { useEffect, useState } from 'react';
import { Button, Dialog, Input, cn } from '@kay-am/ui';
import { Archive, ArchiveRestore, Bot, DollarSign, GitBranch, Trash2 } from 'lucide-react';
import type { TaskId } from '@kay-am/types';
import { useAppStore } from '../store';

interface SessionSettingsDialogProps {
  taskId: TaskId;
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
  { id: 'budget', label: 'Budget', icon: <DollarSign size={14} aria-hidden /> },
];

const DANGER_NAV: NavItem = {
  id: 'danger',
  label: 'Delete',
  icon: <Trash2 size={14} aria-hidden />,
};

export function SessionSettingsDialog({
  taskId,
  open,
  onClose,
  archived,
  onArchive,
  onUnarchive,
}: SessionSettingsDialogProps) {
  const session = useAppStore((s) => s.sessions.find((x) => x.id === taskId) ?? null);
  const branch = useAppStore((s) => s.sessionBranches[taskId] ?? null);
  const budget = useAppStore((s) => s.sessionBudgets[taskId] ?? null);
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const loadSessionBudget = useAppStore((s) => s.loadSessionBudget);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const renameTask = useAppStore((s) => s.renameTask);
  const deleteTask = useAppStore((s) => s.deleteTask);

  const [active, setActive] = useState<Section>('general');
  const [goalDraft, setGoalDraft] = useState('');
  const [capDraft, setCapDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActive('general');
    setError(null);
    setBusy(false);
    setConfirmDelete(false);
    void loadSessionBudget(taskId);
  }, [open, taskId, loadSessionBudget]);

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
      await renameTask(taskId, trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onSaveCap = async () => {
    const parsed = parseFloat(capDraft);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setError('cap must be a positive number');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setSessionBudget(taskId, parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteTask(taskId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
              hint="branch is created when the session spawns and cannot be renamed."
            >
              <div className="inline-flex items-center gap-2 rounded-md bg-subtle px-2.5 py-2 text-xs text-muted-foreground ring-1 ring-border-soft">
                <GitBranch size={12} aria-hidden />
                <code className="font-mono text-foreground">{branch ?? 'unknown'}</code>
              </div>
            </Field>
            <Field label="provider" hint="set at creation time.">
              <span className="inline-flex w-fit items-center gap-2 rounded-md bg-subtle px-2.5 py-1.5 text-xs text-muted-foreground ring-1 ring-border-soft">
                {session.providerPreference.defaultProvider}
              </span>
            </Field>
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
                    <span>consider archiving instead — keeps history and is reversible.</span>
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
