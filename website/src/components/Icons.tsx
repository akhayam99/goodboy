// Minimal inline SVGs that match the lucide-react icons used in the real
// Goodboy app. Pure presentational. No deps, no runtime overhead.

type P = { size?: number; className?: string }

function S({ size = 14, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

export const IconPlus = (p: P) => (
  <S {...p}>
    <path d="M5 12h14M12 5v14" />
  </S>
)
export const IconList = (p: P) => (
  <S {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </S>
)
export const IconTarget = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </S>
)
export const IconSparkles = (p: P) => (
  <S {...p}>
    <path d="M9.5 3 11 7l4 1.5L11 10l-1.5 4L8 10l-4-1.5L8 7zM18 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM18 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
  </S>
)
export const IconHelp = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
  </S>
)
export const IconClipboard = (p: P) => (
  <S {...p}>
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </S>
)
export const IconPullRequest = (p: P) => (
  <S {...p}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <circle cx="18" cy="18" r="3" />
  </S>
)
export const IconFolder = (p: P) => (
  <S {...p}>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </S>
)
export const IconTerminal = (p: P) => (
  <S {...p}>
    <path d="m4 17 6-6-6-6M12 19h8" />
  </S>
)
export const IconArrowDown = (p: P) => (
  <S {...p}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </S>
)
export const IconArrowUp = (p: P) => (
  <S {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </S>
)
export const IconBranch = (p: P) => (
  <S {...p}>
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </S>
)
export const IconCheck = (p: P) => (
  <S {...p}>
    <path d="M20 6 9 17l-5-5" />
  </S>
)
// lucide `layers` — the app's real workflow icon (sidebar + Workflow Studio).
export const IconLayers = (p: P) => (
  <S {...p}>
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m6.08 9.5-3.49 1.59a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83L17.92 9.5" />
    <path d="m6.08 14.5-3.49 1.59a1 1 0 0 0 0 1.81l8.6 3.9a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.81l-3.49-1.59" />
  </S>
)
