import { Check, Copy, Trash2, Undo2 } from 'lucide-react';
import { OverflowMenu, tintClasses, type OverflowMenuItem } from '@goodboy/ui';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import { StudioTrail } from '../../../../../shared/components/StudioShell/StudioTrail';
import type { SaveStatus } from '../../WorkflowsPanel/useWorkflowEditor';

type Props = {
  readonly name: string;
  readonly saveStatus: SaveStatus;
  readonly isSavedWorkflow: boolean;
  readonly isDirty: boolean;
  readonly disabled: boolean;
  readonly onBack: () => void;
  readonly onDuplicate: () => void;
  readonly onUndo: () => void;
  readonly onDelete: () => void;
};

const STATUS_LABEL: Record<SaveStatus, string> = {
  saving: 'Saving',
  saved: 'Saved',
  unsaved: 'Not saved yet',
};

export const EditorTrail = ({
  name,
  saveStatus,
  isSavedWorkflow,
  isDirty,
  disabled,
  onBack,
  onDuplicate,
  onUndo,
  onDelete,
}: Props) => {
  const duplicateItem: OverflowMenuItem = {
    kind: 'item',
    key: 'duplicate',
    label: 'Duplicate',
    icon: Copy,
    onClick: onDuplicate,
  };
  const undoItem: OverflowMenuItem = {
    kind: 'item',
    key: 'undo',
    label: 'Undo changes since opened',
    icon: Undo2,
    onClick: onUndo,
  };
  const deleteItem: OverflowMenuItem = {
    kind: 'item',
    key: 'delete',
    label: isSavedWorkflow ? 'Delete' : 'Discard',
    icon: Trash2,
    destructive: true,
    onClick: onDelete,
  };
  const candidates: ReadonlyArray<OverflowMenuItem | null> = [
    isSavedWorkflow ? duplicateItem : null,
    isDirty ? undoItem : null,
    deleteItem,
  ];
  const items = candidates.filter((item): item is OverflowMenuItem => item !== null);

  return (
    <StudioTrail
      segments={[
        {
          id: 'workflows',
          label: 'Workflows',
          icon: CONCEPT_ICONS.workflows,
          iconClassName: tintClasses(CONCEPT_TONE.workflows).icon,
          onSelect: onBack,
        },
        {
          id: 'workflow',
          label: name.trim() === '' ? 'Untitled workflow' : name.trim(),
          icon: CONCEPT_ICONS.workflows,
        },
      ]}
      accessory={
        <>
          <span
            role="status"
            className="inline-flex shrink-0 items-center gap-1 text-secondary text-faint-foreground"
          >
            {saveStatus === 'saved' ? <Check size={ICON_SIZE.row} aria-hidden /> : null}
            {STATUS_LABEL[saveStatus]}
          </span>
          <OverflowMenu
            label="Workflow actions"
            disabled={disabled}
            align="left"
            trigger={<CONCEPT_ICONS.more size={ICON_SIZE.control} aria-hidden />}
            items={items}
          />
        </>
      }
    />
  );
};
