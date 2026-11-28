import { storedUserOriginOf, storedUserTextOf, type UserOrigin } from '@goodboy/core/auto';

type Params = {
  readonly payload: unknown;
};

type OriginParams = {
  readonly origin: UserOrigin;
  readonly userText: string | null;
};

const textOfOrigin = ({ origin, userText }: OriginParams): string | null => {
  switch (origin) {
    case 'operator':
    case 'permission': {
      const note = userText?.trim() ?? '';
      return note === '' ? null : note;
    }
    case 'continue':
    case 'answers':
    case 'system':
      return null;
    default: {
      const unreachable: never = origin;
      return unreachable;
    }
  }
};

export const noteTextOf = ({ payload }: Params): string | null => {
  const origin = storedUserOriginOf({ value: payload });
  if (origin === 'unknown' || origin === null) {
    return null;
  }
  return textOfOrigin({ origin, userText: storedUserTextOf({ value: payload }) });
};
