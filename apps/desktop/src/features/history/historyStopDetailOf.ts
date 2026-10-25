import type { SessionEventPayload } from '@goodboy/types';
import { historyStopCause } from './historyStopCause';

type Params = {
  readonly payload: SessionEventPayload | null;
};

type FilesParams = {
  readonly files: ReadonlyArray<string>;
};

const SHOWN_FILES = 2;

type PathParams = {
  readonly path: string;
};

const baseNameOf = ({ path }: PathParams): string =>
  path
    .split('/')
    .filter((part) => part.length > 0)
    .pop() ?? path;

const namesOf = ({ files }: FilesParams): string => {
  const shown = files.slice(0, SHOWN_FILES).map((path) => baseNameOf({ path }));
  const hidden = files.length - shown.length;
  if (hidden > 0) {
    return `${shown.join(', ')} and ${hidden} more`;
  }
  return shown.join(' and ');
};

export const historyStopDetailOf = ({ payload }: Params): string | null => {
  const files = payload?.files ?? [];
  if (payload?.reason !== 'stuck' && files.length > 0) {
    return `Conflict in ${namesOf({ files })}`;
  }
  const cause = historyStopCause({ reason: payload?.reason, message: payload?.title });
  if (cause === null) {
    return null;
  }
  return `${cause.charAt(0).toUpperCase()}${cause.slice(1)}`;
};
