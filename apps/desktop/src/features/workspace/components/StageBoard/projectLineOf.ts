import type { SessionProjectMount } from '@goodboy/types';

type Params = {
  readonly mounts: ReadonlyArray<Pick<SessionProjectMount, 'mountName'>>;
};

export const projectLineOf = ({ mounts }: Params): string => {
  const names = [...new Set(mounts.map((mount) => mount.mountName))];
  const [first] = names;
  if (first === undefined) {
    return '';
  }
  if (names.length === 1) {
    return first;
  }
  return `${first} +${names.length - 1}`;
};
