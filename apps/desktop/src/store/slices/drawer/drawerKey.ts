import type { DrawerContent } from './state';

export const drawerKey = (content: DrawerContent): string => {
  switch (content.kind) {
    case 'slot-history':
      return `slot-history:${content.payload.slotKey}`;
    case 'explore-file':
      return `explore-file:${content.payload.entry.relPath}`;
    default: {
      const exhaustive: never = content;
      return String(exhaustive);
    }
  }
};
