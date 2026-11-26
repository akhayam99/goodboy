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
    const isShown = (): boolean =>
      (get().drawerGrid ?? EMPTY_DRAWER_GRID).columns.some((column) =>
        column.some((panel) => panel.kind === opened),
      );
    get().undoable({
      message,
      isCurrent: () => dockGridOwner.read() === sessionId && isShown(),
      undo: async () => {
        const entry = (get().drawerGrid ?? EMPTY_DRAWER_GRID).columns
          .flat()
          .find((panel) => panel.kind === opened);
        if (entry === undefined) {
          return false;
        }
        get().closeDrawerEntry({ entry });
        return true;
      },
    });
  };
};
