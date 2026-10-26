import { Code } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';

type Props = {
  readonly isLocked: boolean;
  readonly isRawEditing: boolean;
  readonly historyCount: number;
  readonly onToggleRaw: () => void;
  readonly onOpenVersions: () => void;
};

export const SlotSourceActions = ({
  isLocked,
  isRawEditing,
  historyCount,
  onToggleRaw,
  onOpenVersions,
}: Props) => (
  <div className="flex items-center gap-1">
    {historyCount > 0 ? (
      <Button variant="ghost" size="sm" onClick={onOpenVersions}>
        {`Versions ${historyCount}`}
      </Button>
    ) : null}
    <Button
      variant="ghost"
      size="sm"
      disabled={isLocked}
      aria-pressed={isRawEditing}
      onClick={onToggleRaw}
    >
      <Code size={ICON_SIZE.row} aria-hidden />
      {isRawEditing ? 'Done' : 'Edit source'}
    </Button>
  </div>
);
