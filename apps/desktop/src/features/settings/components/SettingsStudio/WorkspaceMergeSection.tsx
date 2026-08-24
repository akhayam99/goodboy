import { useCallback, useEffect, useState } from 'react';
import { Check, Merge } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { listWorkspaceMergeCandidates, type WorkspaceMergeCandidate } from '@goodboy/db';
import { Button, Divider, SectionHeader, cn, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { tauriDatabase } from '../../../../shared/lib/db';
import { useToast } from '../../../../app/components/Toast';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceMergeSection = ({ workspaceId }: Props) => {
  const mergeWorkspaces = useAppStore((s) => s.mergeWorkspaces);
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<ReadonlyArray<WorkspaceMergeCandidate>>([]);
  const [selected, setSelected] = useState<ReadonlySet<WorkspaceId>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await listWorkspaceMergeCandidates({
        db: tauriDatabase,
        targetWorkspaceId: workspaceId,
      });
      setCandidates(rows);
    } catch {
      setCandidates([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    setSelected(new Set());
    setConfirming(false);
    setError(null);
    void refresh();
  }, [refresh]);

  const toggle = (id: WorkspaceId) => {
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const onMerge = async () => {
    setBusy(true);
    setError(null);
    try {
      await mergeWorkspaces({
        sourceWorkspaceIds: [...selected],
        targetWorkspaceId: workspaceId,
      });
      showToast(
        'success',
        `grouped ${selected.size} ${selected.size === 1 ? 'workspace' : 'workspaces'}`,
      );
      setSelected(new Set());
      setConfirming(false);
      await refresh();
    } catch (mergeError) {
      setError(formatError(mergeError));
    } finally {
      setBusy(false);
    }
  };

  const count = selected.size;

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <Divider />
      <section id="merge" className="flex flex-col gap-4">
        <SectionHeader
          label="Group workspaces"
          hint="Move the projects, sessions, and connections of other workspaces into this one."
        />
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1.5" aria-label="Workspaces to group">
            {candidates.map((candidate) => {
              const checked = selected.has(candidate.id);
              return (
                <li key={candidate.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={busy}
                    onClick={() => toggle(candidate.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left motion-safe:transition-colors',
                      checked
                        ? 'border-primary/60 bg-primary/5'
                        : 'border-border-soft/60 bg-subtle/20 hover:border-primary/40',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border',
                        checked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border',
                      )}
                    >
                      {checked ? <Check size={11} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {candidate.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {candidate.projectCount}{' '}
                        {candidate.projectCount === 1 ? 'project' : 'projects'} ·{' '}
                        {candidate.sessionCount}{' '}
                        {candidate.sessionCount === 1 ? 'session' : 'sessions'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2">
            {!confirming ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || count === 0}
                onClick={() => setConfirming(true)}
              >
                <Merge size={13} aria-hidden />
                Group {count > 0 ? `${count} ` : ''}into this workspace
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-md bg-danger/5 px-2 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void onMerge()}
                  disabled={busy}
                  className={busy ? 'animate-border-pulse' : undefined}
                >
                  {busy ? (
                    'Grouping…'
                  ) : (
                    <>
                      <Check size={12} aria-hidden />
                      Confirm merge of {count} {count === 1 ? 'workspace' : 'workspaces'}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
          {error !== null ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Sessions keep their folders on disk. Splitting a workspace back out is manual, so double
            check the selection.
          </p>
        </div>
      </section>
    </div>
  );
};
