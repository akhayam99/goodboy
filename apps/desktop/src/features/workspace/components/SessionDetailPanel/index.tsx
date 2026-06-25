import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  Copy,
  FolderOpen,
  Pencil,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { Input, cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { SessionStageBadge } from '../../../session/components/SessionStageBadge';
import { openInEditor } from '../../../../shared/lib/editor';
import { OverflowMenu, type OverflowMenuItem } from '../../../../shared/components/OverflowMenu';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip';
import { useSessionTitleRename } from '../../../session/hooks/useSessionTitleRename';

// The folder CTA only ever opens the reference editors Goodboy auto-detects.
// Other detected editors (Zed, Vim, …) are intentionally not surfaced here.
const REFERENCE_EDITORS = new Set(['code', 'cursor']);

const ICON_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

type ConfirmPillProps = {
  readonly label: string;
  readonly confirmAria: string;
  readonly danger?: boolean;
  readonly busy?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

const ConfirmPill = ({
  label,
  confirmAria,
  danger,
  busy,
  onConfirm,
  onCancel,
}: ConfirmPillProps) => (
  <span className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-background/95 px-1 py-0.5 shadow-sm">
    <span className="px-0.5 text-2xs text-muted-foreground">{label}</span>
    <button
      type="button"
      onClick={onConfirm}
      disabled={busy}
      title={confirmAria}
      aria-label={confirmAria}
      className={cn(
        'rounded p-0.5 motion-safe:transition-colors disabled:opacity-50',
        danger ? 'text-danger hover:bg-danger/10' : 'text-foreground hover:bg-muted/60',
      )}
    >
      <Check size={12} aria-hidden />
    </button>
    <button
      type="button"
      onClick={onCancel}
      disabled={busy}
      title="cancel"
      aria-label="cancel"
      className="rounded p-0.5 text-muted-foreground motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
    >
      <X size={12} aria-hidden />
    </button>
  </span>
);

type SessionDetailPanelProps = {
  session: Session;
  onOpenSessionSettings: () => void;
};

export const SessionDetailPanel = ({ session, onOpenSessionSettings }: SessionDetailPanelProps) => {
  const worktreePath = useAppStore((s) => s.sessionWorktrees[session.id as SessionId]?.[0] ?? null);
  const externalTask = useAppStore(
    (s) => s.sessionExternalTasks?.[session.id as SessionId] ?? null,
  );
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const loadDetectedEditors = useAppStore((s) => s.loadDetectedEditors);
  const archiveTask = useAppStore((s) => s.archiveTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const unarchiveTask = useAppStore((s) => s.unarchiveTask);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const { showToast } = useToast();
  const archived = Boolean(session.archivedAt);

  const rename = useSessionTitleRename({
    sessionId: session.id as SessionId,
    currentTitle: session.goal,
  });
  const [armed, setArmed] = useState<'archive' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (detectedEditors.length === 0) {
      void loadDetectedEditors();
    }
  }, []);

  useEffect(() => {
    if (!armed) {
      return;
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArmed(null);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [armed]);

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

  const copyPath = async () => {
    if (!worktreePath) {
      return;
    }
    try {
      await navigator.clipboard.writeText(worktreePath);
      showToast('success', 'worktree path copied');
    } catch (err) {
      showToast('error', `couldn't copy path: ${formatError(err)}`);
    }
  };

  const doUnarchive = () => {
    unarchiveTask(session.id as SessionId).catch((err: unknown) => {
      showToast('error', `couldn't unarchive: ${formatError(err)}`);
    });
  };

  const doArchive = () => {
    setBusy(true);
    archiveTask(session.id as SessionId)
      .catch((err: unknown) => showToast('error', `couldn't archive: ${formatError(err)}`))
      .finally(() => {
        setBusy(false);
        setArmed(null);
      });
  };

  const doDelete = () => {
    setBusy(true);
    deleteTask(session.id as SessionId)
      .catch((err: unknown) => showToast('error', `couldn't delete: ${formatError(err)}`))
      .finally(() => {
        setBusy(false);
        setArmed(null);
      });
  };

  const folderItems = useMemo<ReadonlyArray<OverflowMenuItem>>(() => {
    const items: OverflowMenuItem[] = [];
    const refEditors = detectedEditors.filter((ed) => REFERENCE_EDITORS.has(ed.binary));
    if (refEditors.length === 0) {
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
      for (const ed of refEditors) {
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
    items.push({ kind: 'separator', key: 'path-sep' });
    items.push({
      kind: 'item',
      key: 'copy-path',
      label: 'Copy path',
      icon: Copy,
      onClick: () => void copyPath(),
      disabled: !worktreePath,
    });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedEditors, worktreePath]);

  return (
    <div className="flex shrink-0 flex-col gap-2 px-2 pb-2 pt-2.5">
      <div className="flex items-center gap-2">
        <SessionStageBadge session={session} />
        <div className="group/goal flex min-w-0 flex-1 items-center gap-1.5">
          {rename.renaming ? (
            <div className="flex flex-1 flex-col gap-0.5">
              <Input
                autoFocus
                value={rename.draft}
                maxLength={rename.maxLength}
                onChange={(e) => rename.setDraft(e.target.value)}
                onBlur={() => void rename.commit()}
                onKeyDown={rename.onKeyDown}
                aria-label="session goal"
                className="h-7 text-xs font-semibold"
              />
              {rename.error && <span className="text-2xs text-danger">{rename.error}</span>}
            </div>
          ) : (
            <>
              <span className="line-clamp-2 min-w-0 text-xs font-semibold leading-snug text-foreground">
                {session.goal}
              </span>
              <button
                type="button"
                onClick={rename.start}
                title="Edit goal"
                aria-label="edit goal"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-[opacity,color,background-color] hover:bg-muted/60 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] group-hover/goal:opacity-100 motion-reduce:opacity-60"
              >
                <Pencil size={11} aria-hidden />
              </button>
            </>
          )}
        </div>
        {externalTask ? <ExternalTaskChip task={externalTask} variant="full" /> : null}
        <OverflowMenu
          items={folderItems}
          label="open worktree"
          triggerClassName={ICON_BUTTON}
          trigger={<FolderOpen size={13} aria-hidden />}
        />
        <button
          type="button"
          onClick={onOpenSessionSettings}
          title="Open settings for this session"
          aria-label="session settings"
          className={ICON_BUTTON}
        >
          <Settings2 size={13} aria-hidden />
        </button>
        {archived ? (
          <button
            type="button"
            onClick={doUnarchive}
            title="Unarchive session"
            aria-label="unarchive session"
            className={ICON_BUTTON}
          >
            <ArchiveRestore size={13} aria-hidden />
          </button>
        ) : armed === 'archive' ? (
          <ConfirmPill
            label="Archive?"
            confirmAria="archive session"
            busy={busy}
            onConfirm={doArchive}
            onCancel={() => setArmed(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setArmed('archive')}
            title="Archive session"
            aria-label="archive session"
            className={ICON_BUTTON}
          >
            <Archive size={13} aria-hidden />
          </button>
        )}
        {armed === 'delete' ? (
          <ConfirmPill
            label="Delete?"
            confirmAria="delete session"
            danger
            busy={busy}
            onConfirm={doDelete}
            onCancel={() => setArmed(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setArmed('delete')}
            title="Delete session"
            aria-label="delete session"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <Trash2 size={13} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
};
