import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, Button, MenuItems, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { wireframeVersionLabel, type WireframeVersion } from '../../wireframeVersion';

type Props = {
  readonly label: string;
  readonly versions: ReadonlyArray<WireframeVersion>;
  readonly value: number;
  readonly onChange: (revision: number) => void;
};

export const RevisionPicker = ({ label, versions, value, onChange }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-80 max-w-[calc(100vw-2rem)]',
    expectedHeight: 240,
    expectedWidth: 320,
  });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={label}
      className="py-1"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          onClick={dropdown.toggle}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          aria-label={`${label}: v${value}`}
        >
          v{value}
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
        </Button>
      }
    >
      <MenuItems
        onClose={dropdown.close}
        items={versions.map((version) => ({
          kind: 'item' as const,
          key: String(version.revision),
          label: `v${version.revision} ${wireframeVersionLabel({ version })}`,
          onClick: () => onChange(version.revision),
        }))}
      />
    </AnchoredPopover>
  );
};
