import { Button, HeaderActions } from '@goodboy/ui';
import type { PlanEditorModel } from './usePlanEditor';

const SAVE_BLOCKED_REASON = 'A newer version exists. Copy your text, discard, then edit again.';

type Props = {
  readonly editor: PlanEditorModel;
};

export const PlanEditorActions = ({ editor }: Props) => (
  <HeaderActions
    button={
      <Button variant="ghost" size="sm" onClick={editor.leave} disabled={editor.isSaving}>
        Cancel
      </Button>
    }
    primary={
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
    }
  />
);
