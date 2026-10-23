import { ArrowDown, ArrowUp, Copy, Save, Trash2 } from 'lucide-react';
import { AnchoredPopover, Button, useDropdown } from '@goodboy/ui';
import type { MenuEntry } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { AppMenuList } from '../../../actions/AppMenuList';

type Props = {
  readonly ordinal: number;
  readonly stepCount: number;
  readonly disabled: boolean;
  readonly canSaveAsStep: boolean;
  readonly deleteLabel: string;
  readonly onDuplicate?: () => void;
  readonly onSaveAsStep?: () => void;
  readonly onMoveUp?: () => void;
  readonly onMoveDown?: () => void;
  readonly onDelete: () => void;
};

const LABEL = 'Step actions';

export const StepEditorMenu = ({
  ordinal,
  stepCount,
  disabled,
  canSaveAsStep,
  deleteLabel,
  onDuplicate,
  onSaveAsStep,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-60',
    expectedWidth: 208,
    expectedHeight: 200,
    disabled,
  });
  const items: ReadonlyArray<MenuEntry> = [
    ...(onDuplicate === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            key: 'duplicate',
            label: 'Duplicate',
            icon: Copy,
            onSelect: onDuplicate,
          },
        ]),
    ...(onSaveAsStep === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            key: 'save-as-step',
            label: 'Save as step',
            icon: Save,
            isDisabled: !canSaveAsStep,
            onSelect: onSaveAsStep,
          },
        ]),
    ...(onMoveUp === undefined || onMoveDown === undefined
      ? []
      : [
          { kind: 'separator' as const, key: 'move-separator' },
          {
            kind: 'item' as const,
            key: 'move-up',
            label: 'Move up',
            icon: ArrowUp,
            isDisabled: ordinal === 1,
            onSelect: onMoveUp,
          },
          {
            kind: 'item' as const,
            key: 'move-down',
            label: 'Move down',
            icon: ArrowDown,
            isDisabled: ordinal === stepCount,
            onSelect: onMoveDown,
          },
        ]),
    ...(onDuplicate === undefined && onSaveAsStep === undefined && onMoveUp === undefined
      ? []
      : [{ kind: 'separator' as const, key: 'delete-separator' }]),
    {
      kind: 'item',
      key: 'delete',
      label: deleteLabel,
      icon: Trash2,
      isDestructive: true,
      onSelect: onDelete,
    },
  ];

  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="shrink-0"
      trigger={
        <Button
          variant="ghost"
          size="sm"
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          disabled={disabled}
          onClick={dropdown.toggle}
        >
          <CONCEPT_ICONS.more size={ICON_SIZE.control} aria-hidden />
          More options
        </Button>
      }
    >
      <AppMenuList label={LABEL} entries={items} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
