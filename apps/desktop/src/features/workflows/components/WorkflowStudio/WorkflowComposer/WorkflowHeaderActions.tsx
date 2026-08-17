import { useState } from 'react';
import { ArrowLeft, Copy, RotateCcw, Trash2 } from 'lucide-react';
import { Button, GhostActionButton, InlineConfirm } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly isNew: boolean;
  readonly saving: boolean;
  readonly generating: boolean;
  readonly canGenerate: boolean;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onGenerate: () => void;
  readonly onReset: () => void;
  readonly onBack: () => void;
};

export const WorkflowHeaderActions = ({
  isNew,
  saving,
  generating,
  canGenerate,
  onDuplicate,
  onDelete,
  onGenerate,
  onReset,
  onBack,
}: Props) => {
  const [confirmation, setConfirmation] = useState<'delete' | 'reset' | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <GhostActionButton icon={ArrowLeft} label="All workflows" onClick={onBack} />
        <GhostActionButton
          icon={Copy}
          label="Duplicate"
          disabled={saving || isNew}
          onClick={onDuplicate}
        />
        <GhostActionButton
          icon={RotateCcw}
          label="Reset"
          disabled={saving}
          onClick={() => setConfirmation('reset')}
        />
        <GhostActionButton
          icon={Trash2}
          label={isNew ? 'Discard' : 'Delete'}
          tone="danger"
          disabled={saving}
          onClick={() => setConfirmation('delete')}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={onGenerate}
          disabled={saving || generating || !canGenerate}
        >
          <CONCEPT_ICONS.enhance size={13} aria-hidden />
          {generating ? 'Working on your workflow' : 'Rewrite with agent'}
        </Button>
      </div>

      {confirmation === 'reset' ? (
        <InlineConfirm
          role="alert"
          icon={<RotateCcw size={12} aria-hidden />}
          title="Discard local changes?"
          description="Restores the last saved version of this workflow."
          confirmLabel="Reset"
          onConfirm={onReset}
          onCancel={() => setConfirmation(null)}
        />
      ) : null}
      {confirmation === 'delete' ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={12} aria-hidden />}
          title={isNew ? 'Discard this draft?' : 'Delete this workflow?'}
          description={
            isNew
              ? 'Removes the local draft from this workspace.'
              : 'Removes this workflow from the preset list.'
          }
          confirmLabel={isNew ? 'Discard' : 'Delete'}
          onConfirm={onDelete}
          onCancel={() => setConfirmation(null)}
        />
      ) : null}
    </div>
  );
};
