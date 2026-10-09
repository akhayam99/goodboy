import type { MenuTriggerSize } from '@goodboy/ui';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { OnArm } from '../../../../shared/components/HeaderConfirm/armedAction';
import type { ActionViewing, ArtifactActionTarget } from '../../../actions/types';

type Props = {
  readonly target: ArtifactActionTarget;
  readonly label: string;
  readonly anchorKey?: string | null;
  readonly viewing?: ActionViewing | null;
  readonly size?: MenuTriggerSize;
  readonly onArm?: OnArm;
};

export const ArtifactOverflowMenu = ({
  target,
  label,
  anchorKey = null,
  viewing = null,
  size = 'compact',
  onArm,
}: Props) => (
  <ObjectOverflowMenu
    target={target}
    label={label}
    tooltip="More actions"
    size={size}
    hideWhenEmpty={size === 'control'}
    anchorKey={anchorKey}
    viewing={viewing}
    onArm={onArm}
  />
);
