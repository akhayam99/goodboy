import { useState } from 'react';
import { GitMerge } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ActionConfirmPanel } from '../../../../../../features/actions/components/ActionControls/ActionConfirmPanel';
import type { ResolvedAction } from '../../../../../../features/actions/types';
import type { ActionControls } from '../../../../../../features/actions/useActionControls';

const MERGE: ResolvedAction = {
  id: 'pullRequest.merge',
  label: 'Merge',
  shortLabel: 'Merge',
  icon: GitMerge,
  group: 'act',
  slot: 'primary',
  pendingLabel: null,
  shortcut: null,
  description: null,
  blockedReason: null,
  isUndoable: false,
  choices: null,
  isBusy: false,
  confirm: {
    title: 'Merge #318 into main?',
    description: 'Choose how it lands on main.',
    confirmLabel: 'Merge pull request',
    role: 'primary',
    choice: {
      label: 'Merge method',
      defaultId: 'squash',
      options: [
        {
          id: 'squash',
          label: 'Squash and merge',
          detail: 'One commit on main',
          disabledReason: null,
        },
        {
          id: 'rebase',
          label: 'Rebase and merge',
          detail: '5 commits on top of main',
          disabledReason: null,
        },
      ],
    },
  },
};

export const ActionPanelScene = () => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isMerged, setIsMerged] = useState(false);
  const controls: ActionControls = {
    target: null,
    actions: [MERGE],
    inSlot: () => [MERGE],
    pendingId: null,
    confirming: isConfirming ? MERGE : null,
    failure: null,
    trigger: () => setIsConfirming(true),
    confirm: async () => {
      await Promise.resolve();
      setIsConfirming(false);
      setIsMerged(true);
    },
    cancel: () => setIsConfirming(false),
    retry: () => undefined,
  };
  return (
    <main
      data-slot="confirm-sweep-scene"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background p-6"
    >
      <div data-slot="branch-header" className="relative flex min-w-0 flex-col gap-2">
        <div className="flex h-8 items-center justify-between gap-2">
          <h1 className="min-w-0 truncate text-title text-foreground">
            Batch settlement writes for Northwind
          </h1>
          <Button
            size="sm"
            variant="primary"
            disabled={isMerged}
            aria-haspopup="dialog"
            onClick={() => controls.trigger({ actionId: MERGE.id })}
          >
            {isMerged ? 'Merged' : 'Merge'}
          </Button>
        </div>
        <ActionConfirmPanel controls={controls} />
      </div>
    </main>
  );
};
