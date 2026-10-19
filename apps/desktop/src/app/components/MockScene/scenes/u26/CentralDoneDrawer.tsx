import { AppShell } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerPlacement } from '../../../../../store/slices/drawer/selectDrawerPlacement';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { shellArrangement } from '../../../../shellArrangement';
import { CentralDoneColumn } from './CentralDoneColumn';

const arrangement = shellArrangement({ hasWorkspace: true, isSidebarCollapsed: true });

export const CentralDoneDrawer = () => {
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const drawerPlacement = useAppStore(selectDrawerPlacement);
  return (
    <div style={{ width: 1440, height: 900 }} className="[&>div]:h-full [&>div]:w-full">
      <AppShell
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={<div aria-hidden />}
        main={<CentralDoneColumn initialOpenId={null} />}
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        drawerSizing={drawerSizing}
        drawerPlacement={drawerPlacement}
      />
    </div>
  );
};
