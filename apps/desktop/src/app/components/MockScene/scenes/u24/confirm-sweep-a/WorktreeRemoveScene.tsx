import { useState } from 'react';
import { ConfirmPopover } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

const WorktreeIcon = CONCEPT_ICONS.worktree;
const LINES = [
  'The worktree at /work/notify-relay has 3 uncommitted files and 1 unpushed commit.',
  'Removing the worktree deletes its directory. The branch and its commits stay in the repository.',
];

export const WorktreeRemoveScene = () => {
  const [isRemoved, setIsRemoved] = useState(false);
  return (
    <main
      data-slot="confirm-sweep-scene"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background p-6"
    >
      <div
        data-slot="mount-row"
        className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-md px-2"
      >
        <span className="min-w-0 truncate text-label text-foreground">notify-relay</span>
        {isRemoved ? (
          <span className="text-meta text-faint-foreground">Removed</span>
        ) : (
          <ConfirmPopover
            width="w-96"
            role="danger"
            icon={<WorktreeIcon size={ICON_SIZE.row} aria-hidden />}
            title="Close branch for notify-relay?"
            confirmLabel="Close branch"
            onConfirm={async () => {
              await Promise.resolve();
              setIsRemoved(true);
            }}
            trigger={({ arm }) => (
              <button
                type="button"
                aria-label="Close branch for notify-relay"
                aria-haspopup="dialog"
                onClick={arm}
                className="rounded-md px-2 py-1 text-label text-faint-foreground hover:bg-hover hover:text-danger"
              >
                Close branch
              </button>
            )}
          >
            <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
              {LINES.map((line) => (
                <p key={line} className="break-words">
                  {line}
                </p>
              ))}
            </div>
          </ConfirmPopover>
        )}
      </div>
    </main>
  );
};
