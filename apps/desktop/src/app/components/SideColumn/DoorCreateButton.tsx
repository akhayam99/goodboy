import { Plus } from '@goodboy/ui/icons';
import { IconButton, PANE_RHYTHM } from '@goodboy/ui';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly shortcut?: string;
  readonly onCreate: () => void;
};

export const DoorCreateButton = ({ id, label, shortcut, onCreate }: Props) => (
  <div className={PANE_RHYTHM.navRail.action}>
    <IconButton
      icon={Plus}
      label={label}
      {...(shortcut !== undefined && { shortcut })}
      tooltipSide="right"
      size="xs"
      data-door-create={id}
      onClick={onCreate}
      className="text-faint-foreground"
    />
  </div>
);
