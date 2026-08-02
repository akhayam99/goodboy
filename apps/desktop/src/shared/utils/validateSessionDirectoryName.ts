type Params = {
  readonly name: string;
};

export type SessionDirectoryNameValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly kind: SessionDirectoryNameValidationErrorKind };

export type SessionDirectoryNameValidationErrorKind =
  | 'empty'
  | 'too_long'
  | 'path_separator'
  | 'dot_dot'
  | 'leading_dot'
  | 'trailing_dot_or_space'
  | 'control_character'
  | 'reserved_character';

const MAX_DIRECTORY_NAME_LENGTH = 60;
const CONTROL_CHARACTER_RE = /\p{Cc}/u;
const RESERVED_CHARACTER_RE = /[:*?"<>|]/;

export const validateSessionDirectoryName = ({
  name,
}: Params): SessionDirectoryNameValidationResult => {
  if (name === '') {
    return { ok: false, kind: 'empty' };
  }
  if (Array.from(name).length > MAX_DIRECTORY_NAME_LENGTH) {
    return { ok: false, kind: 'too_long' };
  }
  if (name.includes('/') || name.includes('\\')) {
    return { ok: false, kind: 'path_separator' };
  }
  if (name.includes('..')) {
    return { ok: false, kind: 'dot_dot' };
  }
  if (name.startsWith('.')) {
    return { ok: false, kind: 'leading_dot' };
  }
  if (name.endsWith('.') || name.endsWith(' ')) {
    return { ok: false, kind: 'trailing_dot_or_space' };
  }
  if (CONTROL_CHARACTER_RE.test(name)) {
    return { ok: false, kind: 'control_character' };
  }
  if (RESERVED_CHARACTER_RE.test(name)) {
    return { ok: false, kind: 'reserved_character' };
  }
  return { ok: true };
};
