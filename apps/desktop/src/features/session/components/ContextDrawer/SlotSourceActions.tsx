import { Eye, History, Pencil } from 'lucide-react';
import { OverflowMenu } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly isLocked: boolean;
  readonly historyCount: number;
  readonly onEdit: () => void;
  readonly onOpenVersions: () => void;
  readonly onToggleVisibility: () => void;
};

export const SlotSourceActions = ({
  label,
  isLocked,
  historyCount,
  onEdit,
  onOpenVersions,
  onToggleVisibility,
}: Props) => (
  <OverflowMenu
    label={`${label} actions`}
    entries={[
      {
        kind: 'item',
        key: 'edit',
        label: 'Edit',
        icon: Pencil,
        isDisabled: isLocked,
        onSelect: onEdit,
      },
      {
        kind: 'item',
        key: 'versions',
        label: 'Versions',
        icon: History,
        isDisabled: historyCount === 0,
        onSelect: onOpenVersions,
      },
      {
        kind: 'item',
        key: 'visibility',
        label: 'Who reads this',
        icon: Eye,
        onSelect: onToggleVisibility,
      },
    ]}
  />
);
