import { ListTree } from 'lucide-react';
import { AnchoredPopover, Button, useDropdown } from '@goodboy/ui';
import type { ReportOutlineEntry } from '../../reportOutline';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ReportOutlineNav } from './ReportOutlineNav';

type Props = {
  readonly entries: ReadonlyArray<ReportOutlineEntry>;
  readonly activeId: string | null;
  readonly onSelect: (id: string) => void;
};

export const ReportContentsMenu = ({ entries, activeId, onSelect }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-64 max-w-[calc(100vw-2rem)]',
    expectedHeight: 260,
    expectedWidth: 256,
  });

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Contents"
      className="max-h-80 overflow-y-auto p-2"
      anchorClassName="self-start"
      trigger={
        <Button
          variant="ghost"
          size="sm"
          onClick={dropdown.toggle}
          aria-expanded={dropdown.open}
          data-testid="report-outline-toggle"
        >
          <ListTree size={ICON_SIZE.row} aria-hidden />
          Contents
          <span className="tabular-nums text-muted-foreground">{entries.length}</span>
        </Button>
      }
    >
      <ReportOutlineNav
        entries={entries}
        activeId={activeId}
        showHeader={false}
        onSelect={(id) => {
          onSelect(id);
          dropdown.close();
        }}
      />
    </AnchoredPopover>
  );
};
