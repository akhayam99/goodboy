import { ArrowDown, ArrowUp, Copy, Save, Trash2 } from 'lucide-react';
import { AnchoredPopover, IconButton, MenuItems, cn, useDropdown } from '@goodboy/ui';
import type { OverflowMenuItem } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

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
  const items: ReadonlyArray<OverflowMenuItem> = [
    ...(onDuplicate === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            key: 'duplicate',
            label: 'Duplicate',
            icon: Copy,
            onClick: onDuplicate,
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
            disabled: !canSaveAsStep,
            onClick: onSaveAsStep,
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
            disabled: ordinal === 1,
            onClick: onMoveUp,
          },
          {
            kind: 'item' as const,
            key: 'move-down',
            label: 'Move down',
            icon: ArrowDown,
            disabled: ordinal === stepCount,
            onClick: onMoveDown,
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
      destructive: true,
      onClick: onDelete,
    },
  ];

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={LABEL}
      anchorClassName="shrink-0"
      className="py-1"
      trigger={
        <IconButton
          variant="ghost"
          icon={CONCEPT_ICONS.more}
          iconSize={ICON_SIZE.control}
          label={LABEL}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          disabled={disabled}
          onClick={dropdown.toggle}
          className={cn(dropdown.open && 'bg-muted')}
        />
      }
    >
      <MenuItems items={items} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
