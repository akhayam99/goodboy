import { DockPanelsScene, type DockPanelsShape } from '../../u49/DockPanelsScene';
import { useDockDropDrive, type DockDropAim } from './useDockDropDrive';

type Props = {
  readonly shape: DockPanelsShape;
  readonly aim: DockDropAim;
};

export const DockDropChipsScene = ({ shape, aim }: Props) => {
  useDockDropDrive({ aim });
  return <DockPanelsScene shape={shape} />;
};
