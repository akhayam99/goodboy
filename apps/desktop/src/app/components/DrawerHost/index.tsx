import { useAppStore } from '../../../store';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { SlotHistoryDrawer } from '../../../features/session/components/SessionWorkspace/parts/SlotHistoryDrawer';
import { ExploreFileDrawer } from '../../../features/explore/components/ExploreFileDrawer';

export const DrawerHost = () => {
  const drawer = useAppStore(selectOpenDrawer);
  const closeDrawer = useAppStore((s) => s.closeDrawer);

  if (drawer === null) {
    return null;
  }
  switch (drawer.kind) {
    case 'slot-history':
      return (
        <SlotHistoryDrawer
          sessionId={drawer.sessionId}
          slotKey={drawer.payload.slotKey}
          onClose={closeDrawer}
        />
      );
    case 'explore-file':
      return (
        <ExploreFileDrawer
          sessionDir={drawer.payload.sessionDir}
          entry={drawer.payload.entry}
          onClose={closeDrawer}
        />
      );
    default: {
      const exhaustive: never = drawer;
      throw new Error(`unknown drawer kind: ${String(exhaustive)}`);
    }
  }
};
