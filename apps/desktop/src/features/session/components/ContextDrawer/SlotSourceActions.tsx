import { ObjectOverflowMenu } from '../../../actions/ObjectOverflowMenu';

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
  <ObjectOverflowMenu
    label={`${label} actions`}
    target={{
      kind: 'contextSlot',
      facts: {
        isLocked,
        hasVersions: historyCount > 0,
        onEdit,
        onOpenVersions,
        onToggleVisibility,
      },
    }}
  />
);
