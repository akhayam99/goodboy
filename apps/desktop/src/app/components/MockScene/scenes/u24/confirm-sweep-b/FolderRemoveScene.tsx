import { useState } from 'react';
import { Button } from '@goodboy/ui';
import { FolderRemoveConfirm } from '../../../../../../features/storage/components/StoragePage/FolderRemoveConfirm';
import type { StorageFolder } from '../../../../../../store/slices/storage/types';

const FOLDER: StorageFolder = {
  path: '/work/payments-api',
  repoRoot: '/repos/payments-api',
  branch: 'feature/refund-flow',
  origin: 'archived',
  why: 'archived-session',
  sessionId: null,
  sessionGoal: 'Speed up the payout export',
  mountId: null,
  revision: null,
  ledgerId: null,
  workspaceId: null,
  sessionActivityAt: null,
  sizeBytes: 482_000_000,
  sizedAt: null,
  facts: {
    path: '/work/payments-api',
    exists: true,
    isRegistered: true,
    branch: 'feature/refund-flow',
    lastCommitAt: null,
    localOnlyCommits: 0,
    changedFiles: 3,
    changedSample: 'ledger.ts',
    reasons: [],
  },
  keptAt: null,
  keptUntil: null,
};

export const FolderRemoveScene = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <main
      data-slot="confirm-sweep-scene"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background p-6"
    >
      <div
        data-slot="storage-folder-row"
        className="relative flex h-10 min-w-0 items-center gap-3 rounded-sm px-2 hover:bg-hover"
      >
        <span className="min-w-0 flex-1 truncate font-mono text-code text-foreground">
          {FOLDER.branch}
        </span>
        <span className="text-meta text-muted-foreground">482 MB</span>
        <Button variant="ghost-danger" size="sm" onClick={() => setIsOpen(true)}>
          Remove
        </Button>
        <FolderRemoveConfirm
          folder={FOLDER}
          intent={isOpen ? 'force' : null}
          onClose={() => setIsOpen(false)}
        />
      </div>
    </main>
  );
};
