import { useCallback, useEffect, useRef, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Dialog, Input } from '@goodboy/ui';
import { Check, FolderPlus, Loader2 } from 'lucide-react';
import { useAppStore, useWorkspaces } from '../../../../store';
import { MAX_WORKSPACES } from '../../../../shared/lib/features';
import { formatError } from '../../../../shared/lib/errors';
import { validateGitRepo } from '../../../../shared/lib/repo';

interface WorkspaceLinkDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Add a new workspace by pointing at a local git repo. The horizontal
 * workspace switcher (WorkspaceSelect) already lists all linked workspaces, so
 * this dialog focuses on the single thing the switcher can't do: link a new
 * one. Past versions also hosted a "Recent" tab; that overlapped with the
 * switcher and confused the primary action, so it was dropped.
 */
export function WorkspaceLinkDialog({ open, onClose }: WorkspaceLinkDialogProps) {
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const workspaces = useWorkspaces();
  const atCap = workspaces.length >= MAX_WORKSPACES;

  const [path, setPath] = useState('');
  const [validating, setValidating] = useState(false);
  const [validPath, setValidPath] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pathInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPath('');
    setValidating(false);
    setValidPath(false);
    setValidationError(null);
    setSubmitError(null);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (path.length === 0) {
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
          const result = await validateGitRepo(path);
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
  }, [path]);

  const onPick = useCallback(async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === 'string') {
      setPath(picked);
      pathInputRef.current?.focus();
    }
  }, []);

  const onSubmit = useCallback(async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const ws = await addWorkspace({ rootPath: path });
      await setCurrentWorkspace(ws.id);
      onClose();
    } catch (err) {
      setSubmitError(formatError(err));
    } finally {
      setBusy(false);
    }
  }, [path, addWorkspace, setCurrentWorkspace, onClose]);

  const primaryDisabled = busy || !validPath || atCap;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Add workspace"
      description="Point Goodboy at a local git repo. Each session opens its own worktree off it."
      footer={
        <>
          {submitError ? <span className="mr-auto text-xs text-danger">{submitError}</span> : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={primaryDisabled} aria-busy={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : 'Add workspace'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FolderPlus size={15} className="shrink-0 text-muted-foreground" aria-hidden />
          <span className="font-semibold">repository</span>
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
              autoFocus
              value={path}
              placeholder="/path/to/repo"
              onChange={(e) => setPath(e.target.value)}
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
          ) : validationError && path.length > 0 ? (
            <span className="text-xs text-danger">{validationError}</span>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              the directory needs a <code>.git</code> folder.
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
