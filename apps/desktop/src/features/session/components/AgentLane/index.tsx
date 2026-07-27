import type { ReactNode } from 'react';
import { AgentCompletionTabs } from './AgentCompletionTabs';
import type { CompletionTab } from './completionTab';

type Props = {
  readonly ariaLabel: string;
  readonly activeLabel?: string;
  readonly completedLabel?: string;
  readonly activeCount: number;
  readonly completedCount: number;
  readonly tab: CompletionTab;
  readonly onTabChange: (tab: CompletionTab) => void;
  readonly toolbar?: ReactNode;
  readonly isEmpty: boolean;
  readonly emptyActive: ReactNode;
  readonly emptyCompleted: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
};

export const AgentLane = ({
  ariaLabel,
  activeLabel,
  completedLabel,
  activeCount,
  completedCount,
  tab,
  onTabChange,
  toolbar,
  isEmpty,
  emptyActive,
  emptyCompleted,
  footer,
  children,
}: Props) => (
  <div className="flex flex-col gap-3">
    <AgentCompletionTabs
      ariaLabel={ariaLabel}
      activeLabel={activeLabel}
      completedLabel={completedLabel}
      activeCount={activeCount}
      completedCount={completedCount}
      value={tab}
      onChange={onTabChange}
    />
    {toolbar}
    {isEmpty && (tab === 'active' ? emptyActive : emptyCompleted)}
    {!isEmpty && children}
    {footer}
  </div>
);
