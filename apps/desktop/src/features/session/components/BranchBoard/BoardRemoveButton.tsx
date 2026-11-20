import { useState } from 'react';
import { Trash2 } from '@goodboy/ui/icons';
import { Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import { useBoardContext } from './useBoardContext';

const PULL_REQUESTS_STAY = 'The pull requests stay.';

type Props = {
  readonly mountIds: ReadonlyArray<string> | null;
  readonly variant: 'secondary' | 'quiet';
};

export const BoardRemoveButton = ({ mountIds, variant }: Props) => {
  const { removal } = useBoardContext();
  const [isConfirming, setIsConfirming] = useState(false);
  const wanted = mountIds === null ? null : new Set<string>(mountIds);
  const targets = removal.targets.filter((target) => wanted === null || wanted.has(target.mountId));
  if (targets.length === 0) {
    return null;
  }
  const isOne = targets.length === 1;
  const size = removal.sizeLabel === null ? '' : ` · ${removal.sizeLabel}`;
  const label =
    wanted !== null
      ? NAMES.deleteLocalBranch
      : `${isOne ? NAMES.deleteLocalBranch : NAMES.deleteLocalBranches}${size}`;
  const button = (
    <Button
      size="sm"
      variant={variant}
      intent="destructive"
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
      title={isOne ? `${NAMES.deleteLocalBranch}?` : `Delete ${targets.length} local branches?`}
      description={`${targets.map((target) => target.branch).join(', ')}. ${
        isOne ? 'Its folder goes too.' : 'Each folder goes too.'
      } ${PULL_REQUESTS_STAY}`}
      confirmLabel={isOne ? NAMES.deleteLocalBranch : NAMES.deleteLocalBranches}
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
