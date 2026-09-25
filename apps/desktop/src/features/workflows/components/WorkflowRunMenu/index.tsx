import { useEffect, useState } from 'react';
import { Ban, CircleCheck, Trash2, type LucideIcon } from 'lucide-react';
import {
  AnchoredPopover,
  IconButton,
  InlineConfirm,
  cn,
  tintClasses,
  useDropdown,
  type ConfirmRole,
} from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { CLOSE_WORKFLOW_COPY } from '../../closeWorkflowCopy';

type MenuItemKind = 'close' | 'discard' | 'delete';

type MenuItemSpec = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly role: ConfirmRole;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
};

const MENU_ITEMS: Record<MenuItemKind, MenuItemSpec> = {
  close: {
    icon: CircleCheck,
    label: CLOSE_WORKFLOW_COPY.label,
    role: 'alert',
    title: CLOSE_WORKFLOW_COPY.title,
    description: CLOSE_WORKFLOW_COPY.description,
    confirmLabel: CLOSE_WORKFLOW_COPY.label,
  },
  discard: {
    icon: Ban,
    label: 'Discard workflow',
    role: 'alert',
    title: 'Discard workflow?',
    description:
      'Moves the run to Discarded, where you can restore it. Agents already started stay in the session.',
    confirmLabel: 'Discard',
  },
  delete: {
    icon: Trash2,
    label: 'Delete workflow run',
    role: 'danger',
    title: 'Delete workflow run?',
    description: 'Permanently removes this workflow run from the session.',
    confirmLabel: 'Delete',
  },
};

const MENU_ORDER: ReadonlyArray<MenuItemKind> = ['close', 'discard', 'delete'];

type Props = {
  readonly workflowName: string;
  readonly onClose?: (() => void) | null;
  readonly onDiscard?: (() => void) | null;
  readonly onDelete?: (() => void) | null;
  readonly triggerClassName?: string;
};

export const WorkflowRunMenu = ({
  workflowName,
  onClose = null,
  onDiscard = null,
  onDelete = null,
  triggerClassName,
}: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-80',
    expectedWidth: 320,
    expectedHeight: 160,
  });
  const [confirming, setConfirming] = useState<MenuItemKind | null>(null);
  const label = `${workflowName} workflow actions`;
  const handlers: Record<MenuItemKind, (() => void) | null> = {
    close: onClose,
    discard: onDiscard,
    delete: onDelete,
  };
  const kinds = MENU_ORDER.filter((kind) => handlers[kind] !== null);

  useEffect(() => {
    if (dropdown.open) {
      return;
    }
    setConfirming(null);
  }, [dropdown.open]);

  if (kinds.length === 0) {
    return null;
  }
  const confirmSpec = confirming === null ? null : MENU_ITEMS[confirming];
  const confirmHandler = confirming === null ? null : handlers[confirming];

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
          className={cn('size-7', triggerClassName, dropdown.open && 'bg-muted opacity-100')}
        />
      }
    >
      {confirmSpec !== null && confirmHandler !== null ? (
        <InlineConfirm
          role={confirmSpec.role}
          icon={<confirmSpec.icon size={ICON_SIZE.control} aria-hidden />}
          title={confirmSpec.title}
          description={confirmSpec.description}
          confirmLabel={confirmSpec.confirmLabel}
          surface="plain"
          onConfirm={() => {
            dropdown.close();
            confirmHandler();
          }}
          onCancel={() => setConfirming(null)}
        />
      ) : (
        kinds.map((kind) => {
          const spec = MENU_ITEMS[kind];
          const isDanger = spec.role === 'danger';
          return (
            <button
              key={kind}
              type="button"
              role="menuitem"
              onClick={() => setConfirming(kind)}
              className={cn(
                'flex w-full items-center gap-2 px-2.5 py-1.5 text-left motion-safe:transition-colors',
                isDanger
                  ? cn(
                      tintClasses('danger').text,
                      tintClasses('danger').hoverBg,
                      'hover:text-danger',
                    )
                  : 'text-foreground hover:bg-hover',
              )}
            >
              <spec.icon size={11} aria-hidden className="shrink-0" />
              {spec.label}
            </button>
          );
        })
      )}
    </AnchoredPopover>
  );
};
