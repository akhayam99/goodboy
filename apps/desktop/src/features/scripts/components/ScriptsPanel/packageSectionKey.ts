import type { MountId } from '@goodboy/types';

type Params = {
  readonly mountId: MountId;
  readonly sectionKey: string;
};

export const packageSectionKey = ({ mountId, sectionKey }: Params): string =>
  `${mountId}:${sectionKey}`;
