import { useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Archive, Keyboard, Plug, Settings, SlidersHorizontal } from 'lucide-react'
import { cn, Divider } from '@goodboy/ui'
import { StudioShell } from '../../../../shared/components/StudioShell'
import { AppScopePanel } from './AppScopePanel'

type Props = {
  readonly initialFocus?: string
  readonly onClose: () => void
}

type NavItem = {
  readonly id: string
  readonly label: string
  readonly icon: ReactNode
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'editor', label: 'Editor', icon: <SlidersHorizontal size={13} aria-hidden /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={13} aria-hidden /> },
  { id: 'integrations', label: 'Integrations', icon: <Plug size={13} aria-hidden /> },
  { id: 'advanced', label: 'Config backup', icon: <Archive size={13} aria-hidden /> },
  { id: 'initialization', label: 'Danger zone', icon: <AlertTriangle size={13} aria-hidden /> },
]

export const SettingsStudio = ({ initialFocus, onClose }: Props) => {
  const scrollToRef = useRef<(id: string) => void>(() => {})
  const [active, setActive] = useState(() =>
    NAV_ITEMS.some((i) => i.id === initialFocus) ? (initialFocus as string) : NAV_ITEMS[0]!.id,
  )

  const jump = (id: string) => {
    setActive(id)
    scrollToRef.current(id)
  }

  return (
    <StudioShell
      icon={Settings}
      title="Settings"
      workspaceName="App settings"
      closeLabel="close settings"
      onClose={onClose}
    >
      {(requestClose) => (
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="settings sections"
            className="flex w-52 shrink-0 flex-col gap-1 bg-subtle/40 p-3"
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => jump(item.id)}
                aria-current={active === item.id ? 'true' : undefined}
                className={cn(
                  'relative flex items-center gap-2 rounded-md py-2 pl-3 pr-2 text-left text-sm motion-safe:transition-colors',
                  active === item.id
                    ? 'bg-background font-medium text-foreground shadow-sm before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-primary'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <Divider orientation="vertical" />
          <div className="min-h-0 flex-1">
            <AppScopePanel
              initialSection={initialFocus}
              requestClose={requestClose}
              registerScrollTo={(fn) => {
                scrollToRef.current = fn
              }}
            />
          </div>
        </div>
      )}
    </StudioShell>
  )
}
