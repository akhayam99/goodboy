import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import { AnchoredConfirm } from '../../../../../shared/components/AnchoredConfirm';
import type { useWorkflowEditor } from '../../WorkflowsPanel/useWorkflowEditor';
import { EditorTrail } from './EditorTrail';

type Props = {
  readonly editor: ReturnType<typeof useWorkflowEditor>;
  readonly isDisabled: boolean;
};

export const EditorLead = ({ editor, isDisabled }: Props) => {
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);

  return (
    <div className="relative flex flex-col gap-3">
      <EditorTrail
        name={editor.form.name}
        saveStatus={editor.saveStatus}
        isSavedWorkflow={editor.isSavedWorkflow}
        isDirty={editor.isDirty}
        disabled={isDisabled}
        onBack={editor.close}
        onDuplicate={() => void editor.duplicate()}
        onUndo={editor.undoSinceOpened}
        onDelete={() => {
          if (editor.isSavedWorkflow) {
            void editor.remove();
            return;
          }
          setIsConfirmingDiscard(true);
        }}
      />
      <AnchoredConfirm
        role="danger"
        icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
        title="Discard this workflow?"
        description="Nothing is saved yet. The draft is lost."
        confirmLabel="Discard"
        isOpen={isConfirmingDiscard}
        onConfirm={async () => {
          await editor.remove();
          setIsConfirmingDiscard(false);
        }}
        onCancel={() => setIsConfirmingDiscard(false)}
      />
    </div>
  );
};
