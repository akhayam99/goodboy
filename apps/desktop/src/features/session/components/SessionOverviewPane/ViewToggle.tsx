import { SegmentedTabs } from '@goodboy/ui';
import { useOverviewLayout } from '../../overviewLayout/useOverviewLayout';
import { useSwitchOverviewLayout } from '../../overviewLayout/useSwitchOverviewLayout';
import type { OverviewLayout } from '../../overviewLayout/overviewLayoutOf';

const OPTIONS = [
  { value: 'classic', label: 'Classic', tooltip: 'Classic overview' },
  { value: 'new', label: 'New', tooltip: 'New overview (Experimental)' },
] as const;

export const ViewToggle = () => {
  const layout = useOverviewLayout();
  const { switchTo, isPending } = useSwitchOverviewLayout();

  return (
    <SegmentedTabs<OverviewLayout>
      options={OPTIONS.map((option) => ({ ...option, disabled: isPending }))}
      value={layout}
      onChange={(next) => void switchTo({ layout: next, hasUndo: next === 'classic' })}
      size="xs"
      ariaLabel="Overview"
      className="shrink-0"
    />
  );
};
