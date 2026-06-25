import { useEffect } from 'react'
import { Settings2 } from 'lucide-react'
import { Divider } from '@goodboy/ui'
import type { Session } from '@goodboy/types'
import { SessionScopePanel } from '../../../settings/components/SettingsStudio/SessionScopePanel'
import { OverlayHeader } from '../../../../shared/components/OverlayHeader'

type Props = {
  readonly session: Session
  readonly onClose: () => void
}

export const SessionSettingsPane = ({ session, onClose }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [onClose])

  return (
    <div className="flex h-full w-full flex-col bg-background motion-safe:animate-studio-in">
      <OverlayHeader
        icon={Settings2}
        title="Session settings"
        subtitle={session.goal}
        onClose={onClose}
        closeLabel="close session settings"
      />
      <Divider />
      <div className="min-h-0 flex-1">
        <SessionScopePanel sessionId={session.id} />
      </div>
    </div>
  )
}
