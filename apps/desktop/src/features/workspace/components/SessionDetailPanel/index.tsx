import { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, FolderOpen, Settings2, Trash2 } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { SessionStageBadge } from '../../../session/components/SessionStageBadge';
import { openInEditor } from '../../../../shared/lib/editor';
import { OverflowMenu, type OverflowMenuItem } from '../../../../shared/components/OverflowMenu';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip';

type SessionDetailPanelProps = {
  session: Session;
  onOpenSessionSettings: () => void;
};

export const SessionDetailPanel = ({ session, onOpenSessionSettings }: SessionDetailPanelProps) => {
  const worktreePath = useAppStore((s) => s.sessionWorktrees[session.id as SessionId]?.[0] ?? null);
  const renameTask = useAppStore((s) => s.renameTask);
  const externalTask = useAppStore(
    (s) => s.sessionExternalTasks?.[session.id as SessionId] ?? null,
  );
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const loadDetectedEditors = useAppStore((s) => s.loadDetectedEditors);
  const unarchiveTask = useAppStore((s) => s.unarchiveTask);
  const { showToast } = useToast();
  const archived = Boolean(session.archivedAt);

  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    if (detectedEditors.length === 0) {
      void loadDetectedEditors();
    }
  }, []);

  const launchEditor = async (binary: string) => {
    if (!worktreePath) {
      return;
    }
    try {
      await openInEditor(worktreePath, binary);
    } catch (err) {
      showToast('error', `couldn't open editor: ${formatError(err)}`);
    }
  };

  const onToggleArchive = () => {
    if (archived) {
      unarchiveTask(session.id as SessionId).catch((err: unknown) => {
        showToast('error', `couldn't unarchive: ${formatError(err)}`);
      });
      return;
    }
    window.dispatchEvent(new CustomEvent('goodboy:archive-session'));
  };

  const actionItems = useMemo<ReadonlyArray<OverflowMenuItem>>(() => {
    const items: OverflowMenuItem[] = [];

    if (detectedEditors.length === 0) {
      items.push({
        kind: 'item',
        key: 'no-editor',
        label: 'No editor detected',
        icon: FolderOpen,
        onClick: () => undefined,
        disabled: true,
      });
    } else {
      items.push({ kind: 'header', key: 'editor-header', label: 'Open in editor' });
      for (const ed of detectedEditors) {
        items.push({
          kind: 'item',
          key: `editor-${ed.binary}`,
          label: ed.label,
          icon: FolderOpen,
          onClick: () => void launchEditor(ed.binary),
          disabled: !worktreePath,
        });
      }
    }

    items.push({ kind: 'separator', key: 'session-sep' });
    items.push({ kind: 'header', key: 'session-header', label: 'Session' });
    items.push({
      kind: 'item',
      key: 'archive',
      label: archived ? 'Unarchive' : 'Archive',
      icon: archived ? ArchiveRestore : Archive,
      onClick: onToggleArchive,
      hint: archived ? undefined : '⌘⇧A',
    });
    items.push({
      kind: 'item',
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      destructive: true,
      hint: '⌘.',
      onClick: () => window.dispatchEvent(new CustomEvent('goodboy:delete-session')),
    });

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedEditors, worktreePath, archived]);

  const startRename = () => {
    setRenameDraft(session.goal);
    setRenameError(null);
    setRenaming(true);
  };

  const commitRename = async () => {
    if (!renameDraft.trim()) {
      setRenameError('name cannot be empty');
      return;
    }
    try {
      await renameTask(session.id as SessionId, renameDraft.trim());
      setRenaming(false);
      setRenameError(null);
    } catch (err) {
      setRenameError(formatError(err));
    }
  };

  const onRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void commitRename();
    }
    if (e.key === 'Escape') {
      setRenaming(false);
      setRenameError(null);
    }
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 px-2 pb-2 pt-2.5">
      <div className="flex items-center gap-2">
        <SessionStageBadge session={session} />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex flex-col gap-0.5">
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={onRenameKeyDown}
                className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
              />
              {renameError && <span className="text-2xs text-danger">{renameError}</span>}
            </div>
          ) : (
            <span
              className="line-clamp-2 cursor-pointer text-xs font-semibold leading-snug text-foreground"
              onDoubleClick={startRename}
              title="double-click to rename"
            >
              {session.goal}
            </span>
          )}
        </div>
        {externalTask ? <ExternalTaskChip task={externalTask} variant="full" /> : null}
        <button
          type="button"
          onClick={onOpenSessionSettings}
          title="Open settings for this session"
          aria-label="session settings"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Settings2 size={13} aria-hidden />
        </button>
        <OverflowMenu items={actionItems} label="session actions" />
      </div>
    </div>
  );
};
