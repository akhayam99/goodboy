import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../../slice-types';
import { dockGridOwner } from '../dockGridWrites';
import { EMPTY_DRAWER_GRID, type DrawerContent } from '../state';

type Params = {
  readonly sessionId: SessionId | null;
  readonly opened: DrawerContent['kind'];
  readonly message: string;
};

export const announceDockFold = ({ get }: SliceDeps) => {
  return ({ sessionId, opened, message }: Params): void => {
    const gridOf = () => get().drawerGrid ?? EMPTY_DRAWER_GRID;
    const entry = gridOf()
      .columns.flat()
      .find((panel) => panel.kind === opened);
    if (entry === undefined) {
      return;
    }
    const isShown = (): boolean => gridOf().columns.some((column) => column.includes(entry));
    get().undoable({
      message,
      isCurrent: () => dockGridOwner.read() === sessionId && isShown(),
      undo: async () => {
        if (!isShown()) {
          return false;
        }
        get().closeDrawerEntry({ entry });
        return true;
      },
    });
  };
};
