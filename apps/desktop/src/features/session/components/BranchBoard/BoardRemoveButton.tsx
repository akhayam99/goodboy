import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly mountIds: ReadonlyArray<string> | null;
  readonly variant: 'secondary' | 'quiet';
};

export const BoardRemoveButton = ({ mountIds, variant }: Props) => {
  const { removal } = useBoardContext();
  const [isConfirming, setIsConfirming] = useState(false);
  const wanted = mountIds === null ? null : new Set<string>(mountIds);
  const targets = removal.targets.filter((target) => wanted === null || wanted.has(target.mountId));
  const failed = removal.failures.filter(
    (failure) => wanted === null || wanted.has(failure.mountId),
  );
  if (targets.length === 0) {
    return null;
  }
  const isRetry = failed.length > 0;
  const verb = isRetry ? 'Retry removing' : 'Remove';
  const size = removal.sizeLabel === null ? '' : ` · ${removal.sizeLabel}`;
  const label =
    wanted !== null
      ? `${verb} worktree`
      : `${verb} ${targets.length} ${targets.length === 1 ? 'worktree' : 'worktrees'}${size}`;
  const button = (
    <Button
      size="sm"
      variant={variant}
      isBusy={removal.isBusy}
      disabled={removal.isBusy}
      onClick={() => setIsConfirming(true)}
    >
      {wanted === null ? null : <Trash2 size={ICON_SIZE.control} aria-hidden />}
      {label}
    </Button>
  );
  return (
    <ConfirmPopover
      role="danger"
      icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
      title={targets.length === 1 ? 'Remove this worktree?' : `Remove ${targets.length} worktrees?`}
      description={targets.map((target) => target.branch).join(', ')}
      confirmLabel={targets.length === 1 ? 'Remove worktree' : 'Remove worktrees'}
      isOpen={isConfirming}
      anchorClassName="flex min-w-0 items-center"
      onConfirm={() => {
        setIsConfirming(false);
        void removal.run({ mountIds: targets.map((target) => target.mountId) });
      }}
      onCancel={() => setIsConfirming(false)}
      trigger={() => button}
    />
  );
};
