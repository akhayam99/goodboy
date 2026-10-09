import { DrawerHeadersScene } from './drawerChrome/DrawerHeadersScene';
import { DrawerStage } from './drawerChrome/DrawerStage';
import { FloatingSurfacesScene } from './drawerChrome/FloatingSurfacesScene';
import { ToastRaiser } from './drawerChrome/ToastRaiser';
import { prepareAskDraft, prepareToast } from './drawerChrome/prepare';

const PUSH_WIDTH_PX = 1440;
const OVERLAY_WIDTH_PX = 1000;

export const U23_DRAWER_CHROME_SCENES = {
  'drawer-ask-draft': () => <DrawerStage width={PUSH_WIDTH_PX} prepare={prepareAskDraft} />,
  'drawer-headers': DrawerHeadersScene,
  'toast-over-drawer': () => (
    <DrawerStage width={PUSH_WIDTH_PX} prepare={prepareToast}>
      <ToastRaiser />
    </DrawerStage>
  ),
  'toast-over-drawer-overlay': () => (
    <DrawerStage width={OVERLAY_WIDTH_PX} prepare={prepareToast}>
      <ToastRaiser />
    </DrawerStage>
  ),
  'floating-surfaces': FloatingSurfacesScene,
};
