import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { changelogAreaIcon, changelogAreaLabel } from '../../changelogAreas';
import type { ChangelogArea } from '../../changelogAreas';

type Props = {
  readonly area: ChangelogArea;
};

export const AreaTag = ({ area }: Props) => {
  const Icon = changelogAreaIcon({ area });
  return (
    <span className="flex shrink-0 items-center gap-1 text-2xs text-muted-foreground">
      <Icon size={ICON_SIZE.row} aria-hidden />
      {changelogAreaLabel({ area })}
    </span>
  );
};
