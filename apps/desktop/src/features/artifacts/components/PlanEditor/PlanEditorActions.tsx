import { Undo2 } from 'lucide-react';
import { Button, ConfirmPopover, HeaderActions, ICON_SIZE } from '@goodboy/ui';

import type { PlanEditorModel } from './usePlanEditor';

const SAVE_BLOCKED_REASON = 'A newer version exists. Copy your text, discard, then edit again.';

type Props = {
  readonly editor: PlanEditorModel;
};

export const PlanEditorActions = ({ editor }: Props) => (
  <HeaderActions
    button={
      <ConfirmPopover
        role="alert"
        icon={<Undo2 size={ICON_SIZE.row} aria-hidden />}
        title="Discard your edit?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        isOpen={editor.isDiscardAsked}
        onConfirm={editor.discard}
        onCancel={editor.keepEditing}
        trigger={() => (
          <Button variant="ghost" size="sm" onClick={editor.leave} disabled={editor.isSaving}>
            Cancel
          </Button>
        )}
      />
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
