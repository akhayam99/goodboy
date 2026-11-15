import type { ContextType, ReactNode } from 'react';
import { TabActionsSlotContext } from '../../../../shared/components/TabActions/tabActionsSlotContext';
import { BranchDiffContext } from '../../branchDiffContext';
import { BranchRailSlotContext } from '../../branchRailSlotContext';
import { useBranchRailSlot } from '../../hooks/useBranchRailSlot';

type Props = {
  readonly isActive: boolean;
  readonly diff: ContextType<typeof BranchDiffContext>;
  readonly tabActionsSlot: HTMLElement | null;
  readonly children: ReactNode;
};

export const BranchPaneRoot = ({ isActive, diff, tabActionsSlot, children }: Props) => {
  const rail = useBranchRailSlot({ isActive });
  return (
    <BranchDiffContext.Provider value={diff}>
      <TabActionsSlotContext.Provider value={tabActionsSlot}>
        <BranchRailSlotContext.Provider value={rail.railSlot}>
          <div
            ref={rail.setOwnPane}
            data-branch-pane=""
            className="relative flex h-full min-h-0 min-w-0 flex-1"
          >
            {rail.isFramed ? null : (
              <div
                ref={rail.setOwnLead}
                data-branch-lead=""
                className="flex shrink-0 empty:hidden"
              />
            )}
            {children}
          </div>
        </BranchRailSlotContext.Provider>
      </TabActionsSlotContext.Provider>
    </BranchDiffContext.Provider>
  );
};
