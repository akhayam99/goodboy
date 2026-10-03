import { Ellipsis } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { ActionViewing, ArtifactActionTarget } from '../../../actions/types';

type Props = {
  readonly target: ArtifactActionTarget;
  readonly label: string;
  readonly anchorKey?: string | null;
  readonly viewing?: ActionViewing | null;
  readonly triggerClassName?: string;
};

export const ArtifactOverflowMenu = ({
  target,
  label,
  anchorKey = null,
  viewing = null,
  triggerClassName,
}: Props) => (
  <ObjectOverflowMenu
    target={target}
    label={label}
    tooltip="More actions"
    trigger={<Ellipsis size={ICON_SIZE.control} aria-hidden />}
    anchorKey={anchorKey}
    viewing={viewing}
    {...(triggerClassName === undefined ? {} : { triggerClassName })}
  />
);
