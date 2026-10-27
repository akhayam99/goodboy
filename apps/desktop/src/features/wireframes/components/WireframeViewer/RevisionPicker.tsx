import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, Button, ICON_SIZE, type MenuEntry, useDropdown } from '@goodboy/ui';

import { AppMenuList } from '../../../actions/AppMenuList';
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
    expectedHeight: 260,
    expectedWidth: 320,
  });
  const entries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'radio',
      key: 'revision',
      label,
      choices: versions.map((version) => ({
        id: String(version.revision),
        label: `v${version.revision} ${wireframeVersionLabel({ version })}`,
        isCurrent: version.revision === value,
      })),
      onSelect: (choice) => {
        const version = versions.find((candidate) => String(candidate.revision) === choice);
        if (version === undefined) {
          return;
        }
        onChange(version.revision);
      },
    },
  ];
  return (
    <AnchoredPopover
      dropdown={dropdown}
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
      <AppMenuList label={label} entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
