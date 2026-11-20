import { drawerAsideWidthOf } from '../drawerGeometry';

type Props = {
  readonly railWidth: number;
};

export const DrawerSpacer = ({ railWidth }: Props) => (
  <div
    aria-hidden
    data-drawer-spacer=""
    style={{ width: drawerAsideWidthOf({ width: 0, mode: 'closed', railWidth }) }}
    className="shrink-0"
  />
);
