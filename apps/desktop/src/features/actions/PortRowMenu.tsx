import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import { portAnchorKey, portMenuLabel } from './portAnchorKey';
import type { PortActionTarget } from './types';

type Props = {
  readonly target: PortActionTarget;
};

export const PortRowMenu = ({ target }: Props) => (
  <ObjectOverflowMenu
    label={portMenuLabel({ target })}
    target={target}
    anchorKey={portAnchorKey({ target })}
  />
);
