import { DogMascot } from '../../../shared/components/DogMascot'

type Props = {
  readonly onAddWorkspace: () => void
}

export const NoWorkspaceScreen = ({ onAddWorkspace }: Props) => {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 40%, var(--color-background) 100%)',
        }}
        aria-hidden
      />

      <div className="relative flex max-w-2xl flex-col items-center gap-10 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 shadow-lg">
          <DogMascot size={56} className="text-foreground" />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome to Goodboy
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Point at a git repo to create your first workspace. Every session spins up its own
            worktree and branch, your main checkout stays untouched.
          </p>
        </div>

        <button
          type="button"
          onClick={onAddWorkspace}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm motion-safe:transition-colors hover:bg-primary/90"
        >
          Add workspace
        </button>
      </div>
    </div>
  )
}
