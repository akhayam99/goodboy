import { ChevronDown, Copy, Download, FileDown, FolderDown, SquareDashed } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  MenuItems,
  useDropdown,
  type OverflowMenuItem,
} from '@goodboy/ui';
import type { WireframeScreen } from '@goodboy/core';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly screen: WireframeScreen | null;
  readonly isBusy: boolean;
  readonly onExportFolder: () => void;
  readonly onSaveCopy: () => void;
  readonly onCopyJson: () => void;
  readonly onCopyScreen: (screen: WireframeScreen) => void;
};

export const WireframeExportMenu = ({
  screen,
  isBusy,
  onExportFolder,
  onSaveCopy,
  onCopyJson,
  onCopyScreen,
}: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-80 max-w-[calc(100vw-2rem)]',
    expectedHeight: 230,
    expectedWidth: 320,
  });
  const items: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'folder',
      label: 'Export as a folder…',
      description: 'A page per screen, the JSON and its schema, in a folder you pick',
      icon: FolderDown,
      disabled: isBusy,
      onClick: onExportFolder,
    },
    {
      kind: 'item',
      key: 'save',
      label: 'Save a copy to…',
      description: 'The validated document as a JSON file, somewhere you pick',
      icon: FileDown,
      disabled: isBusy,
      onClick: onSaveCopy,
    },
    {
      kind: 'item',
      key: 'copy',
      label: 'Copy JSON',
      description: 'The validated document, ready to paste',
      icon: Copy,
      disabled: isBusy,
      onClick: onCopyJson,
    },
    ...(screen === null
      ? []
      : [
          {
            kind: 'item',
            key: 'copy-screen',
            label: 'Copy this screen as JSON',
            description: `Only ${screen.title}, with its nodes`,
            icon: SquareDashed,
            disabled: isBusy,
            onClick: () => onCopyScreen(screen),
          } satisfies OverflowMenuItem,
        ]),
  ];

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Export"
      className="py-1"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          onClick={dropdown.toggle}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          data-testid="artifact-action-export"
        >
          <Download size={ICON_SIZE.row} aria-hidden />
          Export
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
        </Button>
      }
    >
      <MenuItems items={items} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
