import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, ArrowRight, Layers, Plus } from 'lucide-react'
import { Button } from '@goodboy/ui'

type Props = {
  readonly onNew: () => void
  readonly hasPresets: boolean
}

type GuideStep = {
  readonly text: string
  readonly arrow?: LucideIcon
}

const STEPS: ReadonlyArray<GuideStep> = [
  {
    text: 'Pick a preset on the left to clone or edit, or start a new one.',
    arrow: ArrowLeft,
  },
  {
    text: "Each step is one agent with its own role, provider and model. Steps run in order, each one's output feeds the next.",
  },
  {
    text: 'Drag steps from the Step Library on the right. When it is ready, run it on a session from "Start a workflow".',
    arrow: ArrowRight,
  },
]

export const EmptyGuide = ({ onNew, hasPresets }: Props) => {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Layers size={18} aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              {hasPresets ? 'Build a workflow' : 'Design your first workflow'}
            </span>
            <span className="text-2xs text-muted-foreground">
              Save a sequence of agents once, run it on any session.
            </span>
          </div>
        </div>

        <ol className="flex w-full flex-col gap-2.5 text-left">
          {STEPS.map((step, idx) => {
            const Arrow = step.arrow
            return (
              <li key={idx} className="flex items-start gap-2.5 rounded-lg bg-muted/20 px-3 py-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-medium text-muted-foreground">
                  {idx + 1}
                </span>
                <span className="flex-1 text-2xs leading-relaxed text-muted-foreground">
                  {step.text}
                </span>
                {Arrow ? (
                  <Arrow
                    size={13}
                    className="mt-0.5 shrink-0 text-muted-foreground/60"
                    aria-hidden
                  />
                ) : null}
              </li>
            )
          })}
        </ol>

        <div className="flex flex-col items-center gap-2">
          <Button size="sm" onClick={onNew}>
            <Plus size={13} aria-hidden /> New workflow
          </Button>
          <span className="text-2xs text-muted-foreground/70">
            {hasPresets
              ? 'or pick a preset on the left to edit.'
              : '5 presets ship by default, you can edit or clone them anytime.'}
          </span>
        </div>
      </div>
    </div>
  )
}
