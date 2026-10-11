import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

const TITLES = ['Settlement replay plan', 'Payout export report', 'Checkout wireframe'];

export const ArtifactDeleteScene = () => {
  const [titles, setTitles] = useState<ReadonlyArray<string>>(TITLES);
  return (
    <main
      data-slot="confirm-sweep-scene"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background p-6"
    >
      <h1 className="text-title text-foreground">Recently deleted</h1>
      <ul data-slot="artifact-list" className="flex flex-col gap-0.5">
        {titles.map((title) => (
          <li
            key={title}
            data-artifact-row={title}
            className="flex h-10 min-w-0 items-center gap-2 rounded-md px-2 hover:bg-hover"
          >
            <span className="min-w-0 flex-1 truncate text-label text-foreground">{title}</span>
            <Button variant="secondary" size="sm">
              Restore
            </Button>
            <ConfirmPopover
              role="danger"
              icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
              title={`Delete "${title}" for good?`}
              description="It is removed from this device, with its run history (3 runs). This cannot be undone."
              confirmLabel="Delete permanently"
              returnFocusTo={{ rowSelector: '[data-artifact-row]' }}
              onConfirm={async () => {
                await Promise.resolve();
                setTitles((current) => current.filter((candidate) => candidate !== title));
              }}
              trigger={({ isArmed, arm }) => (
                <Button
                  variant="ghost-danger"
                  size="sm"
                  aria-expanded={isArmed}
                  aria-haspopup="dialog"
                  aria-label={`Delete ${title} permanently`}
                  onClick={arm}
                >
                  Delete permanently
                </Button>
              )}
            />
          </li>
        ))}
      </ul>
    </main>
  );
};
