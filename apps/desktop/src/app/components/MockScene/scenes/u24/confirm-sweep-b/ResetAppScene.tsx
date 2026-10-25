import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, ConfirmPopover, Eyebrow, FieldRow, ICON_SIZE } from '@goodboy/ui';

export const ResetAppScene = () => {
  const [isDone, setIsDone] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <main
      data-slot="confirm-sweep-scene"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-3 bg-background p-6"
    >
      <h2 data-slot="reset-heading" className="flex items-center gap-2">
        <Eyebrow label="Reset" />
      </h2>
      <FieldRow
        label="Delete all data"
        help="Every workspace, session, transcript and rule. Keychain keys are untouched."
      >
        {isDone ? (
          <span className="text-meta text-muted-foreground">Local data deleted.</span>
        ) : (
          <ConfirmPopover
            role="danger"
            icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
            title="Delete every workspace, session and rule?"
            description="This can't be undone. Keychain keys stay. The app starts on a fresh schema after a restart."
            confirmLabel="Delete"
            isOpen={isOpen}
            onConfirm={async () => {
              await Promise.resolve();
              setIsOpen(false);
              setIsDone(true);
            }}
            onCancel={() => setIsOpen(false)}
            trigger={() => (
              <Button variant="ghost-danger" size="sm" onClick={() => setIsOpen(true)}>
                Delete all data
              </Button>
            )}
          />
        )}
      </FieldRow>
    </main>
  );
};
