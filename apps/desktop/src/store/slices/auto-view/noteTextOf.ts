import { storedUserOriginOf, storedUserTextOf, type UserOrigin } from '@goodboy/core/auto';
import { legacyNoteTextOf } from './legacyNoteTextOf';

type Params = {
  readonly payload: unknown;
  readonly text: string;
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

export const noteTextOf = ({ payload, text }: Params): string | null => {
  const origin = storedUserOriginOf({ value: payload });
  if (origin === 'unknown') {
    return null;
  }
  if (origin === null) {
    return legacyNoteTextOf({ text });
  }
  return textOfOrigin({ origin, userText: storedUserTextOf({ value: payload }) });
};
