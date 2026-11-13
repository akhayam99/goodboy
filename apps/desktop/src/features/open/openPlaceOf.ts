import type { OpenPlace, OpenPlaceParams } from './types';

export const openPlaceOf = ({
  target,
  mode,
  isOwnClick,
  sessionId,
}: OpenPlaceParams): OpenPlace => {
  if (target.kind === 'file' || target.kind === 'folder') {
    return 'editor';
  }
  if (target.kind === 'saved-copy' && target.copy === 'wireframe') {
    return 'your-browser';
  }
  return isOwnClick || mode === 'browser' || sessionId === null ? 'your-browser' : 'beside-session';
};
