import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import { portAnchorKey, portMenuLabel } from './portAnchorKey';
import { ROW_MENU_TOOLTIP } from './rowMenuTooltip';
import type { PortActionTarget } from './types';

type Props = {
  readonly target: PortActionTarget;
};

export const PortRowMenu = ({ target }: Props) => (
  <ObjectOverflowMenu
    label={portMenuLabel({ target })}
    tooltip={ROW_MENU_TOOLTIP}
    target={target}
    anchorKey={portAnchorKey({ target })}
  />
);
