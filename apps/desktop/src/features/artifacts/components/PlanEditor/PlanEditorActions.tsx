import { Button } from '@goodboy/ui';
import type { PlanEditorModel } from './usePlanEditor';

const SAVE_BLOCKED_REASON = 'A newer version exists. Copy your text, discard, then edit again.';

type Props = {
  readonly editor: PlanEditorModel;
};

export const PlanEditorActions = ({ editor }: Props) => (
  <span className="flex shrink-0 items-center gap-2">
    <Button
      variant="primary"
      size="sm"
      onClick={() => void editor.save()}
      isBusy={editor.isSaving}
      disabled={!editor.canSave}
      title={editor.canSave ? undefined : SAVE_BLOCKED_REASON}
      data-testid="artifact-save"
      data-filled="true"
    >
      Save
    </Button>
    <Button variant="ghost" size="sm" onClick={editor.leave} disabled={editor.isSaving}>
      Cancel
    </Button>
  </span>
);
