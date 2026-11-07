import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import { portAnchorKey, portMenuLabel } from './portAnchorKey';
import { portRowMenuOf } from './portRowMenuOf';
import { ROW_MENU_TOOLTIP } from './rowMenuTooltip';
import type { PortActionTarget } from './types';

type Props = {
  readonly target: PortActionTarget;
  readonly hasStop: boolean;
};

export const PortRowMenu = ({ target, hasStop }: Props) => {
  const { omit, cuts } = portRowMenuOf({ hasStop });
  return (
    <ObjectOverflowMenu
      label={portMenuLabel({ target })}
      tooltip={ROW_MENU_TOOLTIP}
      target={target}
      anchorKey={portAnchorKey({ target })}
      omit={omit}
      cuts={cuts}
    />
  );
};
