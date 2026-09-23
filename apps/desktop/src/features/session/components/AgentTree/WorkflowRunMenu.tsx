import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AnchoredPopover,
  IconButton,
  InlineConfirm,
  cn,
  tintClasses,
  useDropdown,
} from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly workflowName: string;
  readonly onDelete: () => void;
};

export const WorkflowRunMenu = ({ workflowName, onDelete }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-80',
    expectedWidth: 320,
    expectedHeight: 140,
  });
  const [isConfirming, setIsConfirming] = useState(false);
  const label = `${workflowName} workflow actions`;

  useEffect(() => {
    if (dropdown.open) {
      return;
    }
    setIsConfirming(false);
  }, [dropdown.open]);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={label}
      anchorClassName="shrink-0"
      trigger={
        <IconButton
          variant="ghost"
          icon={CONCEPT_ICONS.more}
          iconSize={ICON_SIZE.row}
          label={label}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className={cn('size-7', dropdown.open && 'bg-muted')}
        />
      }
    >
      {isConfirming ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={ICON_SIZE.control} aria-hidden />}
          title="Delete workflow run?"
          description="Permanently removes this workflow run from the session."
          confirmLabel="Delete"
          surface="plain"
          onConfirm={() => {
            dropdown.close();
            onDelete();
          }}
          onCancel={() => setIsConfirming(false)}
        />
      ) : (
        <button
          type="button"
          role="menuitem"
          onClick={() => setIsConfirming(true)}
          className={cn(
            'flex w-full items-center gap-2 px-2.5 py-1.5 text-left motion-safe:transition-colors',
            tintClasses('danger').text,
            tintClasses('danger').hoverBg,
            'hover:text-danger',
          )}
        >
          <Trash2 size={11} aria-hidden className="shrink-0" />
          Delete workflow run
        </button>
      )}
    </AnchoredPopover>
  );
};
