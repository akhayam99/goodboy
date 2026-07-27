import { Button, Dialog } from '@goodboy/ui';

type Props = {
  readonly open: boolean;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly onCancel: () => void;
};

export const DiscardDraftDialog = ({ open, onSave, onDiscard, onCancel }: Props) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Unsaved changes"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Keep editing
          </Button>
          <Button variant="danger" onClick={onDiscard}>
            Discard
          </Button>
          <Button onClick={onSave}>Save</Button>
        </>
      }
    >
      <p className="text-xs text-muted-foreground">
        This script has unsaved edits. Save them or discard to continue.
      </p>
    </Dialog>
  );
};
