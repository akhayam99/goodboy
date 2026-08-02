const TRANSCRIPT_OWNED_TURN_ERROR_CODE = 'TRANSCRIPT_OWNED_TURN_ERROR';

type TranscriptOwnedTurnError = Error & {
  readonly code: string;
  readonly cause: unknown;
};

type CreateParams = {
  readonly message: string;
  readonly cause: unknown;
};

type GuardParams = {
  readonly error: unknown;
};

const readErrorCode = ({ error }: GuardParams): string | null => {
  if (typeof error !== 'object' || error == null) {
    return null;
  }
  if (!('code' in error)) {
    return null;
  }
  const value = error.code;
  if (typeof value !== 'string') {
    return null;
  }
  return value;
};

export const createTranscriptOwnedTurnError = ({
  message,
  cause,
}: CreateParams): TranscriptOwnedTurnError => {
  const code = TRANSCRIPT_OWNED_TURN_ERROR_CODE;
  return Object.assign(new Error(message), {
    code,
    cause,
  });
};

export const isTranscriptOwnedTurnError = ({ error }: GuardParams): boolean => {
  return readErrorCode({ error }) === TRANSCRIPT_OWNED_TURN_ERROR_CODE;
};
