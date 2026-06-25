import type { SessionId } from '@goodboy/types'
import { Button, type ButtonSize, type ButtonVariant } from '@goodboy/ui'
import { MessagesSquare } from 'lucide-react'
import { useOpenSession } from '../../hooks/useOpenSession'

type Props = {
  readonly sessionId: SessionId
  readonly onOpened?: () => void
  readonly label?: string
  readonly size?: ButtonSize
  readonly variant?: ButtonVariant
}

export const OpenSessionButton = ({
  sessionId,
  onOpened,
  label = 'Open session',
  size = 'sm',
  variant,
}: Props) => {
  const openSession = useOpenSession()
  return (
    <Button size={size} variant={variant} onClick={() => openSession(sessionId, onOpened)}>
      <MessagesSquare size={14} aria-hidden />
      {label}
    </Button>
  )
}
