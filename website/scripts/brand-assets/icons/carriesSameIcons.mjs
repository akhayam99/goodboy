import { icnsChunkDigests } from './icnsChunkDigests.mjs';

export const carriesSameIcons = ({ name, current, next }) => {
  if (!name.endsWith('.icns')) {
    return current.equals(next);
  }
  return icnsChunkDigests(current).join() === icnsChunkDigests(next).join();
};
