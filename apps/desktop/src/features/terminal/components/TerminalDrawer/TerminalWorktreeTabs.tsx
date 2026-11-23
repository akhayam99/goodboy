import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { WorktreeTab } from '../../worktreeTabsOf';

type Props = {
  readonly tabs: ReadonlyArray<WorktreeTab>;
  readonly selectedMountId: string | null;
  readonly onSelect: (params: SelectParams) => void;
};

type SelectParams = {
  readonly tab: WorktreeTab;
};

export const TerminalWorktreeTabs = ({ tabs, selectedMountId, onSelect }: Props) => {
  const options: ReadonlyArray<SegmentedTabOption> = tabs.map((tab) => ({
    value: tab.mountId,
    label: tab.label,
    tooltip: tab.path,
  }));
  return (
    <div className="flex min-w-0 px-2">
      <SegmentedTabs
        ariaLabel="Worktrees"
        size="xs"
        variant="underline"
        options={options}
        value={selectedMountId}
        onChange={(mountId) => {
          const tab = tabs.find((candidate) => candidate.mountId === mountId);
          if (tab !== undefined) {
            onSelect({ tab });
          }
        }}
      />
    </div>
  );
};
