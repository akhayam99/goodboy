import type { SessionExternalTask } from '@goodboy/types';

type Params = {
  readonly tasks: ReadonlyArray<SessionExternalTask> | undefined;
};

export const sessionRefOf = ({ tasks }: Params): string | null => {
  const first = tasks?.find((task) => task.identifier !== '');
  return first === undefined ? null : first.identifier;
};
