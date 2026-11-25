import type { useWorkflowEditor } from '../../WorkflowsPanel/useWorkflowEditor';
import { EditorTrail } from './EditorTrail';

type Props = {
  readonly editor: ReturnType<typeof useWorkflowEditor>;
  readonly isDisabled: boolean;
};

export const EditorLead = ({ editor, isDisabled }: Props) => (
  <div className="relative flex flex-col gap-3">
    <EditorTrail
      name={editor.form.name}
      saveStatus={editor.saveStatus}
      isSavedWorkflow={editor.isSavedWorkflow}
      isDirty={editor.isDirty}
      disabled={isDisabled}
      onBack={editor.isSavedWorkflow ? editor.close : editor.discard}
      onDuplicate={() => editor.duplicate({})}
      onUndo={editor.undoSinceOpened}
      onDelete={() => void editor.remove()}
    />
  </div>
);
