import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Copy,
  FolderOpen,
  Pencil,
  Settings2,
  Trash2,
} from 'lucide-react'
import { Input } from '@goodboy/ui'
import type { Session, SessionId } from '@goodboy/types'
import { useAppStore } from '../../../../store'
import { SessionStageBadge } from '../../../session/components/SessionStageBadge'
import { openInEditor } from '../../../../shared/lib/editor'
import { OverflowMenu, type OverflowMenuItem } from '../../../../shared/components/OverflowMenu'
import { formatError } from '../../../../shared/lib/errors'
import { useToast } from '../../../../app/components/Toast'
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip'

// The folder CTA only ever opens the reference editors Goodboy auto-detects.
// Other detected editors (Zed, Vim, …) are intentionally not surfaced here.
const REFERENCE_EDITORS = new Set(['code', 'cursor'])

const ICON_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]'

type SessionDetailPanelProps = {
  session: Session
  onOpenSessionSettings: () => void
}

export const SessionDetailPanel = ({ session, onOpenSessionSettings }: SessionDetailPanelProps) => {
  const worktreePath = useAppStore((s) => s.sessionWorktrees[session.id as SessionId]?.[0] ?? null)
  const renameTask = useAppStore((s) => s.renameTask)
  const externalTask = useAppStore((s) => s.sessionExternalTasks?.[session.id as SessionId] ?? null)
  const detectedEditors = useAppStore((s) => s.detectedEditors)
  const loadDetectedEditors = useAppStore((s) => s.loadDetectedEditors)
  const unarchiveTask = useAppStore((s) => s.unarchiveTask)
  const setCurrentSession = useAppStore((s) => s.setCurrentSession)
  const { showToast } = useToast()
  const archived = Boolean(session.archivedAt)

  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)

  useEffect(() => {
    if (detectedEditors.length === 0) {
      void loadDetectedEditors()
    }
  }, [])

  const launchEditor = async (binary: string) => {
    if (!worktreePath) {
      return
    }
    try {
      await openInEditor(worktreePath, binary)
    } catch (err) {
      showToast('error', `couldn't open editor: ${formatError(err)}`)
    }
  }

  const copyPath = async () => {
    if (!worktreePath) {
      return
    }
    try {
      await navigator.clipboard.writeText(worktreePath)
      showToast('success', 'worktree path copied')
    } catch (err) {
      showToast('error', `couldn't copy path: ${formatError(err)}`)
    }
  }

  const onToggleArchive = () => {
    if (archived) {
      unarchiveTask(session.id as SessionId).catch((err: unknown) => {
        showToast('error', `couldn't unarchive: ${formatError(err)}`)
      })
      return
    }
    window.dispatchEvent(new CustomEvent('goodboy:archive-session'))
  }

  const folderItems = useMemo<ReadonlyArray<OverflowMenuItem>>(() => {
    const items: OverflowMenuItem[] = []
    const refEditors = detectedEditors.filter((ed) => REFERENCE_EDITORS.has(ed.binary))
    if (refEditors.length === 0) {
      items.push({
        kind: 'item',
        key: 'no-editor',
        label: 'No editor detected',
        icon: FolderOpen,
        onClick: () => undefined,
        disabled: true,
      })
    } else {
      items.push({ kind: 'header', key: 'editor-header', label: 'Open in editor' })
      for (const ed of refEditors) {
        items.push({
          kind: 'item',
          key: `editor-${ed.binary}`,
          label: ed.label,
          icon: FolderOpen,
          onClick: () => void launchEditor(ed.binary),
          disabled: !worktreePath,
        })
      }
    }
    items.push({ kind: 'separator', key: 'path-sep' })
    items.push({
      kind: 'item',
      key: 'copy-path',
      label: 'Copy path',
      icon: Copy,
      onClick: () => void copyPath(),
      disabled: !worktreePath,
    })
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedEditors, worktreePath])

  const startRename = () => {
    setRenameDraft(session.goal)
    setRenameError(null)
    setRenaming(true)
  }

  const commitRename = async () => {
    if (!renameDraft.trim()) {
      setRenameError('name cannot be empty')
      return
    }
    try {
      await renameTask(session.id as SessionId, renameDraft.trim())
      setRenaming(false)
      setRenameError(null)
    } catch (err) {
      setRenameError(formatError(err))
    }
  }

  const onRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void commitRename()
    }
    if (e.key === 'Escape') {
      setRenaming(false)
      setRenameError(null)
    }
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 px-2 pb-2 pt-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void setCurrentSession(null)}
          title="Back to the board"
          aria-label="back to board"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <ArrowLeft size={14} aria-hidden />
          Board
        </button>
        <SessionStageBadge session={session} />
        <div className="group/goal flex min-w-0 flex-1 items-center gap-1.5">
          {renaming ? (
            <div className="flex flex-1 flex-col gap-0.5">
              <Input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={onRenameKeyDown}
                aria-label="session goal"
                className="h-7 text-xs font-semibold"
              />
              {renameError && <span className="text-2xs text-danger">{renameError}</span>}
            </div>
          ) : (
            <>
              <span className="line-clamp-2 min-w-0 text-xs font-semibold leading-snug text-foreground">
                {session.goal}
              </span>
              <button
                type="button"
                onClick={startRename}
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
        <button
          type="button"
          onClick={onToggleArchive}
          title={archived ? 'Unarchive session' : 'Archive session'}
          aria-label={archived ? 'unarchive session' : 'archive session'}
          className={ICON_BUTTON}
        >
          {archived ? <ArchiveRestore size={13} aria-hidden /> : <Archive size={13} aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('goodboy:delete-session'))}
          title="Delete session"
          aria-label="delete session"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </div>
    </div>
  )
}
