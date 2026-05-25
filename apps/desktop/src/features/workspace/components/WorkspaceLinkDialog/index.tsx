import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Dialog, Input, cn } from '@goodboy/ui';
import { Check, FolderCode, FolderPlus, Loader2, Plus } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import { MAX_WORKSPACES } from '../../../../shared/lib/features';
import { formatError } from '../../../../shared/lib/errors';
import { validateGitRepo } from '../../../../shared/lib/repo';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';

type Mode = 'recent' | 'add-new';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

interface WorkspaceLinkDialogProps {
  open: boolean;
  onClose: () => void;
}

export function WorkspaceLinkDialog({ open, onClose }: WorkspaceLinkDialogProps) {
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const workspaces = useWorkspaces();
  const atCap = workspaces.length >= MAX_WORKSPACES;

  const recentWorkspaces = useMemo(() => {
    const cutoff = Date.now() - NINETY_DAYS_MS;
    return [...workspaces]
      .filter((w) => {
        const ts = w.lastAccessedAt ? Date.parse(w.lastAccessedAt) : Date.parse(w.updatedAt);
        return ts >= cutoff;
      })
      .sort((a, b) => {
        const aTs = a.lastAccessedAt ? Date.parse(a.lastAccessedAt) : Date.parse(a.updatedAt);
        const bTs = b.lastAccessedAt ? Date.parse(b.lastAccessedAt) : Date.parse(b.updatedAt);
        return bTs - aTs;
      })
      .slice(0, 5);
  }, [workspaces]);

  const defaultMode: Mode = recentWorkspaces.length === 0 ? 'add-new' : 'recent';

  const [mode, setMode] = useState<Mode>(defaultMode);
  const [selectedId, setSelectedId] = useState<WorkspaceId | null>(recentWorkspaces[0]?.id ?? null);
  const [newPath, setNewPath] = useState('');
  const [validating, setValidating] = useState(false);
  const [validPath, setValidPath] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pathInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const m = recentWorkspaces.length === 0 ? 'add-new' : 'recent';
    setMode(m);
    setSelectedId(recentWorkspaces[0]?.id ?? null);
    setNewPath('');
    setValidating(false);
    setValidPath(false);
    setValidationError(null);
    setSubmitError(null);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (mode !== 'add-new' || newPath.length === 0) {
      setValidPath(false);
      setValidationError(null);
      return;
    }
    setValidating(true);
    setValidPath(false);
    setValidationError(null);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await validateGitRepo(newPath);
          if (result.isRepo) {
            setValidPath(true);
            setValidationError(null);
          } else {
            setValidPath(false);
            setValidationError(result.error ?? 'not a git repository');
          }
        } catch {
          setValidPath(false);
          setValidationError('could not validate path');
        } finally {
          setValidating(false);
        }
      })();
    }, 400);
    return () => clearTimeout(timer);
  }, [newPath, mode]);

  const onPick = useCallback(async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === 'string') {
      setNewPath(picked);
      pathInputRef.current?.focus();
    }
  }, []);

  const onSubmit = useCallback(async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      if (mode === 'recent' && selectedId) {
        await setCurrentWorkspace(selectedId);
      } else if (mode === 'add-new') {
        const ws = await addWorkspace({ rootPath: newPath });
        await setCurrentWorkspace(ws.id);
      }
      onClose();
    } catch (err) {
      setSubmitError(formatError(err));
    } finally {
      setBusy(false);
    }
  }, [mode, selectedId, newPath, addWorkspace, setCurrentWorkspace, onClose]);

  const selectedWorkspace =
    mode === 'recent' && selectedId
      ? (recentWorkspaces.find((w) => w.id === selectedId) ?? null)
      : null;

  const primaryLabel = mode === 'add-new' ? 'Link repository' : 'Open workspace';
  const primaryDisabled =
    busy || (mode === 'recent' && !selectedId) || (mode === 'add-new' && (!validPath || atCap));

  const leftPanel = (
    <div className="flex flex-col gap-3">
      {recentWorkspaces.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <span className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
            Recent
          </span>
          {recentWorkspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => {
                setMode('recent');
                setSelectedId(ws.id);
                setSubmitError(null);
              }}
              className={cn(
                'flex flex-col rounded px-2 py-1.5 text-left motion-safe:transition-colors',
                selectedId === ws.id && mode === 'recent'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <span className="truncate text-sm">{ws.name}</span>
              <span className="text-[10px] text-muted-foreground/60">
                {ws.lastAccessedAt
                  ? formatRelativeDuration(ws.lastAccessedAt) + ' ago'
                  : 'never opened'}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <div
        className={cn(
          'flex flex-col gap-0.5',
          recentWorkspaces.length > 0 && 'border-t border-border-soft pt-3',
        )}
      >
        <button
          type="button"
          onClick={() => {
            setMode('add-new');
            setSelectedId(null);
            setSubmitError(null);
            setTimeout(() => pathInputRef.current?.focus(), 0);
          }}
          className={cn(
            'flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm motion-safe:transition-colors',
            mode === 'add-new'
              ? 'bg-muted font-medium text-foreground'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          <Plus size={13} aria-hidden />
          Add new
        </button>
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      fixedHeightClass="h-[420px]"
      panel={leftPanel}
      panelWidthClass="w-44"
      footer={
        <>
          {submitError ? <span className="mr-auto text-xs text-danger">{submitError}</span> : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={primaryDisabled} aria-busy={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : primaryLabel}
          </Button>
        </>
      }
    >
      {mode === 'recent' && selectedWorkspace ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <FolderCode size={15} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate font-semibold">{selectedWorkspace.name}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-foreground">path</span>
            <span className="break-all font-mono text-xs text-muted-foreground">
              {selectedWorkspace.rootPath}
            </span>
          </div>
          {selectedWorkspace.lastAccessedAt ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-foreground">last accessed</span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeDuration(selectedWorkspace.lastAccessedAt)} ago
              </span>
            </div>
          ) : null}
        </div>
      ) : mode === 'add-new' ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <FolderPlus size={15} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-semibold">add repository</span>
          </div>
          {atCap ? (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
              Workspace limit reached ({MAX_WORKSPACES}). Disconnect one before adding another.
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">repository path</span>
            <div className="flex gap-2">
              <Input
                ref={pathInputRef}
                autoFocus={recentWorkspaces.length === 0}
                value={newPath}
                placeholder="/path/to/repo"
                onChange={(e) => setNewPath(e.target.value)}
                className="flex-1"
              />
              <Button variant="secondary" onClick={() => void onPick()} disabled={busy}>
                Browse
              </Button>
            </div>
            {validating ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 size={11} className="animate-spin" aria-hidden />
                checking…
              </span>
            ) : validPath ? (
              <span className="flex items-center gap-1 text-xs text-success">
                <Check size={11} aria-hidden />
                valid git repository
              </span>
            ) : validationError && newPath.length > 0 ? (
              <span className="text-xs text-danger">{validationError}</span>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                the directory must contain a <code>.git</code> folder.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
