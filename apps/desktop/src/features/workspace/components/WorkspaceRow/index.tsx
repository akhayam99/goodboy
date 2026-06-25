import { cn } from '@goodboy/ui'
import type { Workspace } from '@goodboy/types'
import { useWorkspaceHasUnread } from '../../../../store'
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate'
import { workspaceAccent } from '../../color'

type Props = {
  workspace: Workspace
  density: 'card' | 'row'
  highlighted: boolean
  onOpen: () => void
}

export const WorkspaceRow = ({ workspace, density, highlighted, onOpen }: Props) => {
  const hasUnread = useWorkspaceHasUnread(workspace.id)
  const accent = workspaceAccent(workspace.id)
  const lastSeen = workspace.lastAccessedAt ? formatRelativeDuration(workspace.lastAccessedAt) : ''

  return (
    <button
      type="button"
      onClick={onOpen}
      data-tauri-drag-region="false"
      className={cn(
        'group flex w-full items-center gap-3 rounded-md border px-3 text-left transition-colors',
        density === 'card' ? 'py-2.5' : 'py-2',
        highlighted
          ? 'border-border bg-muted/60'
          : 'border-transparent hover:border-border-soft hover:bg-muted/40',
      )}
    >
      <span
        aria-hidden
        className="h-7 w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{workspace.name}</span>
          {hasUnread ? (
            <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              unread
            </span>
          ) : null}
        </span>
        <span className="block truncate font-mono text-xs text-muted-foreground/80">
          {workspace.rootPath}
        </span>
      </span>
      {lastSeen ? (
        <span className="shrink-0 text-xs text-muted-foreground/60">{lastSeen}</span>
      ) : null}
    </button>
  )
}
