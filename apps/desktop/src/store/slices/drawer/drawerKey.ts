import type { DrawerContent } from './state';

export const drawerKey = (content: DrawerContent): string => {
  switch (content.kind) {
    case 'slot-history':
      return `slot-history:${content.payload.slotKey}`;
    case 'explore-file':
      return `explore-file:${content.payload.entry.relPath}`;
    case 'artifact':
      return `artifact:${content.payload.artifactId}:${content.payload.tab}`;
    case 'plan-part':
      return `plan-part:${content.payload.planId}:${content.payload.index}`;
    default: {
      const exhaustive: never = content;
      return String(exhaustive);
    }
  }
};
