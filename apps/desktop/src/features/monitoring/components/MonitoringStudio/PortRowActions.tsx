import { PortRowMenu } from '../../../actions/PortRowMenu';
import { PortStopControl } from '../../../actions/PortStopControl';
import type { PortActionTarget } from '../../../actions/types';
import { ActionsCell } from './ActionsCell';

type Props = {
  readonly target: PortActionTarget;
  readonly hasStop: boolean;
  readonly hasMenu: boolean;
};

export const PortRowActions = ({ target, hasStop, hasMenu }: Props) => (
  <ActionsCell
    stop={hasStop ? <PortStopControl target={target} /> : null}
    menu={hasMenu ? <PortRowMenu target={target} /> : null}
  />
);
