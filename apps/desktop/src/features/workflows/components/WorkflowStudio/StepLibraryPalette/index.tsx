import { useState } from 'react';
import { EmptyState, SectionHeader } from '@goodboy/ui';
import { Layers, Plus } from 'lucide-react';
import type { ProviderId, StepDef, StepDefId, WorkspaceId } from '@goodboy/types';
import type { StepDefUpsertArgs } from '../../../workflows';
import { LibraryCard } from '../../LibraryCard';
import { LibraryStepForm } from '../../LibraryStepForm';

type Props = {
  readonly library: ReadonlyArray<StepDef>;
  readonly workspaceId: WorkspaceId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onStartDrag: (def: StepDef, e: React.PointerEvent) => void;
  readonly onSaveDef: (args: StepDefUpsertArgs) => void;
  readonly onDeleteDef: (id: StepDefId) => void;
};

export const StepLibraryPalette = ({
  library,
  workspaceId,
  connectedProviders,
  onStartDrag,
  onSaveDef,
  onDeleteDef,
}: Props) => {
  const [editing, setEditing] = useState<StepDefId | 'new' | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        label="Step library"
        hint="Reusable steps. Drag one up into the workflow."
        action={
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border-soft px-2 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
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
          onSave={(args) => {
            onSaveDef(args);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
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

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {library.map((def) =>
          editing === def.id ? (
            <li key={def.id} className="sm:col-span-2">
              <LibraryStepForm
                def={def}
                workspaceId={workspaceId}
                connectedProviders={connectedProviders}
                onSave={(args) => {
                  onSaveDef(args);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <LibraryCard
              key={def.id}
              def={def}
              dragDisabled={false}
              onStartDrag={onStartDrag}
              onEdit={() => setEditing(def.id)}
              onDelete={() => onDeleteDef(def.id)}
            />
          ),
        )}
      </ul>
    </div>
  );
};
