import { SegmentedTabs } from '@goodboy/ui';
import type { CompletionTab } from './completionTab';

type Props = {
  readonly ariaLabel: string;
  readonly activeLabel?: string;
  readonly completedLabel?: string;
  readonly activeCount: number;
  readonly completedCount: number;
  readonly value: CompletionTab;
  readonly onChange: (tab: CompletionTab) => void;
};

export const AgentCompletionTabs = ({
  ariaLabel,
  activeLabel = 'Active',
  completedLabel = 'Completed',
  activeCount,
  completedCount,
  value,
  onChange,
}: Props) => (
  <SegmentedTabs<CompletionTab>
    ariaLabel={ariaLabel}
    options={[
      { value: 'active', label: `${activeLabel} (${activeCount})` },
      { value: 'completed', label: `${completedLabel} (${completedCount})` },
    ]}
    value={value}
    onChange={onChange}
    size="sm"
    fill
  />
);
