import type { MountActionTarget } from '../../actions/types';
import { ObjectOverflowMenu } from '../../actions/ObjectOverflowMenu';
import { ROW_MENU_TOOLTIP } from '../../actions/rowMenuTooltip';
import { MOUNT_ROW_CUTS } from '../mountRowCuts';

type Props = {
  readonly target: MountActionTarget | null;
  readonly projectName: string;
  readonly branch: string;
};

export const MountRowMenuButton = ({ target, projectName, branch }: Props) =>
  target === null ? null : (
    <ObjectOverflowMenu
      target={target}
      label={`${projectName} · ${branch} actions`}
      tooltip={ROW_MENU_TOOLTIP}
      size="compact"
      cuts={MOUNT_ROW_CUTS}
      hideWhenEmpty
    />
  );
