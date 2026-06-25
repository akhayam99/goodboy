import { CircleHelp } from 'lucide-react'
import type { TurnState } from '@goodboy/types'
import { useCurrentSession, useCurrentWorkspace } from '../../../store'
import { TelemetryPill } from '../../../features/providers/components/TelemetryPill'
import { UpdateIndicator } from '../../../features/updater/components/UpdateIndicator'

type StatusBarProps = {
  onFocusWorkspaces?: () => void
}

// Raw state.kind strings are internal; map to human labels. 'idle' is the
// resting state — surfacing it just adds noise, so it reads as no label.
const STATE_LABEL: Record<TurnState['kind'], string | null> = {
  draft: 'draft',
  starting: 'starting',
  idle: null,
  running: 'running',
  error: 'failed',
  ended: 'ended',
}

export const StatusBar = ({ onFocusWorkspaces }: StatusBarProps) => {
  const workspace = useCurrentWorkspace()
  const session = useCurrentSession()
  const stateLabel = session ? STATE_LABEL[session.state.kind] : null

  return (
    <div className="flex w-full items-center gap-3">
      <div className="flex flex-1 items-center gap-3 truncate">
        <span aria-hidden>▸</span>
        <button
          type="button"
          onClick={onFocusWorkspaces}
          title="focus workspaces"
          className="text-foreground/80 hover:text-foreground hover:underline disabled:cursor-default disabled:no-underline"
          disabled={!onFocusWorkspaces}
        >
          {workspace?.name ?? 'no workspace'}
        </button>
        {stateLabel ? <span className="text-muted-foreground">{stateLabel}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <UpdateIndicator variant="bar" />
        <TelemetryPill />
        <span className="inline-flex items-center gap-1" title="open settings">
          <CircleHelp size={11} aria-hidden />
          <kbd className="font-mono">⌘,</kbd>
        </span>
      </div>
    </div>
  )
}
