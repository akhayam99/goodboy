import { FolderGit2, Plug } from 'lucide-react'
import { DogMascot } from '../../../../shared/components/DogMascot'

export const WelcomeStep = () => {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="relative">
        <div className="absolute -inset-6 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 shadow-lg backdrop-blur-sm">
          <DogMascot size={56} className="text-foreground" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome to Goodboy
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Two steps and you are ready to run agents.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-2">
        <SetupRow
          icon={<Plug size={15} className="text-info" aria-hidden />}
          title="Connect a provider"
          detail="The CLI that runs your agents (claude, codex, and more)."
        />
        <SetupRow
          icon={<FolderGit2 size={15} className="text-primary" aria-hidden />}
          title="Connect a workspace"
          detail="A git repo. Every session gets its own worktree and branch."
        />
      </div>
    </div>
  )
}

function SetupRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode
  title: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border-soft/40 bg-subtle/20 px-3.5 py-3 text-left">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/40">
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="text-2xs leading-relaxed text-muted-foreground/80">{detail}</span>
      </div>
    </div>
  )
}
