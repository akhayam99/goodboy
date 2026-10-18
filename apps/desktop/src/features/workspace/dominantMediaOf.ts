import type { FolderSignals } from '@goodboy/types';

const MEDIA = [
  ['video', 'video'],
  ['image', 'images'],
  ['audio', 'audio'],
] as const satisfies ReadonlyArray<readonly ['video' | 'image' | 'audio', string]>;

type Params = {
  readonly signals: FolderSignals;
};

export const dominantMediaOf = ({ signals }: Params): string | null => {
  const found = MEDIA.find(([kind]) => signals.counts[kind] * 2 > signals.totalFiles);
  return found === undefined ? null : found[1];
};
