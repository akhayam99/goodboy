import { Check, ChevronRight, Copy, Trash2, Undo2 } from 'lucide-react';
import { OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
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

export const EditorCrumb = ({
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
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-label">
      <button
        type="button"
        onClick={onBack}
        className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        Workflows
      </button>
      <ChevronRight size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <span className="min-w-0 truncate text-foreground" aria-current="page">
        {name.trim() === '' ? 'Untitled workflow' : name.trim()}
      </span>
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
    </nav>
  );
};
