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
    case 'scriptRun':
      return `scriptRun:${content.payload.mountId ?? ''}:${content.payload.scriptKey}`;
    case 'diff-notes':
      return 'diff-notes';
    case 'review-drafts':
      return 'review-drafts';
    case 'file-diff':
      return `file-diff:${
        content.payload.source.kind === 'commit'
          ? `${content.payload.source.repo}@${content.payload.source.sha}`
          : content.payload.source.worktreePath
      }:${content.payload.path ?? ''}`;
    default: {
      const exhaustive: never = content;
      return String(exhaustive);
    }
  }
};
