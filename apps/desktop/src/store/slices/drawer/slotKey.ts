import { drawerKey } from './drawerKey';
import type { DrawerContent } from './state';

type Params = {
  readonly content: DrawerContent;
};

export const slotKey = ({ content }: Params): string => {
  if (content.kind === 'artifact' || content.kind === 'artifact-document') {
    return `${content.kind}:${content.payload.artifactId}`;
  }
  return drawerKey(content);
};
