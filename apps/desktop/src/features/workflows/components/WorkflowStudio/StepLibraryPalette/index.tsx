import { Fragment, useState } from 'react'
import { Divider, EmptyState, SectionHeader } from '@goodboy/ui'
import { Layers, Plus } from 'lucide-react'
import type { ProviderId, StepDef, StepDefId, WorkspaceId } from '@goodboy/types'
import type { StepDefUpsertArgs } from '../../../workflows'
import { LibraryCard } from '../../LibraryCard'
import { LibraryStepForm } from '../../LibraryStepForm'

type Props = {
  readonly library: ReadonlyArray<StepDef>
  readonly workspaceId: WorkspaceId
  readonly connectedProviders: ReadonlyArray<ProviderId>
  readonly onStartDrag: (def: StepDef, e: React.PointerEvent) => void
  readonly onSaveDef: (args: StepDefUpsertArgs) => void
  readonly onDeleteDef: (id: StepDefId) => void
}

export const StepLibraryPalette = ({
  library,
  workspaceId,
  connectedProviders,
  onStartDrag,
  onSaveDef,
  onDeleteDef,
}: Props) => {
  const [editing, setEditing] = useState<StepDefId | 'new' | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        label="Step library"
        hint="Reusable steps. Drag one into the workflow."
        action={
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border-soft px-2 py-1 text-2xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
          >
            <Plus size={11} aria-hidden /> new step
          </button>
        }
      />

      {editing === 'new' && (
        <LibraryStepForm
          def={null}
          workspaceId={workspaceId}
          connectedProviders={connectedProviders}
          onCommit={(args) => {
            onSaveDef(args)
            // A new step persists on its first valid commit; close so repeated
            // blurs don't insert duplicates. It reappears in the list to re-edit.
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {library.length === 0 && editing !== 'new' && (
        <EmptyState
          icon={Layers}
          title="No library steps yet"
          description="Create one to reuse it across workflows."
          bordered
        />
      )}

      <ul className="flex flex-col">
        {library.map((def, i) =>
          editing === def.id ? (
            <Fragment key={def.id}>
              {i > 0 ? <Divider /> : null}
              <li className="py-2">
                <LibraryStepForm
                  def={def}
                  workspaceId={workspaceId}
                  connectedProviders={connectedProviders}
                  onCommit={onSaveDef}
                  onClose={() => setEditing(null)}
                />
              </li>
            </Fragment>
          ) : (
            <Fragment key={def.id}>
              {i > 0 ? <Divider /> : null}
              <LibraryCard
                def={def}
                dragDisabled={false}
                onStartDrag={onStartDrag}
                onEdit={() => setEditing(def.id)}
                onDelete={() => onDeleteDef(def.id)}
              />
            </Fragment>
          ),
        )}
      </ul>
    </div>
  )
}
