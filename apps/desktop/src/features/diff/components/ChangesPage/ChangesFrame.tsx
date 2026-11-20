import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { BranchRailSlot } from '../../../branch/branchRailSlotContext';

type LayoutParams = {
  readonly shown: ReactNode;
};

type Props = {
  readonly railSlot: BranchRailSlot | null;
  readonly detail: ReactNode;
  readonly layoutOf: (params: LayoutParams) => ReactNode;
};

export const ChangesFrame = ({ railSlot, detail, layoutOf }: Props) => {
  if (railSlot === null) {
    return (
      <div
        data-changes-page=""
        className="flex min-h-0 min-w-0 flex-1 flex-col pl-4 @max-[720px]:pl-2"
      >
        {layoutOf({ shown: detail })}
      </div>
    );
  }
  return (
    <div
      data-changes-page=""
      data-rail-place="frame"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      {railSlot.host === null
        ? null
        : createPortal(
            <div data-changes-rail="" className="flex h-full min-h-0 border-r border-border-soft">
              {layoutOf({ shown: null })}
            </div>,
            railSlot.host,
          )}
      {detail}
    </div>
  );
};
