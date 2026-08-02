import type { SessionDirectoryNameValidationResult } from './validateSessionDirectoryName';

type Params = {
  readonly validation: SessionDirectoryNameValidationResult;
};

export const sessionDirectoryNameValidationMessage = ({ validation }: Params): string | null => {
  if (validation.ok) {
    return null;
  }

  switch (validation.kind) {
    case 'empty':
      return 'Enter the folder name you want to create';
    case 'too_long':
      return 'Use 60 characters or fewer';
    case 'path_separator':
      return 'Use one folder name. Slashes are not allowed';
    case 'dot_dot':
      return 'Consecutive dots are not allowed';
    case 'leading_dot':
      return 'The folder name cannot start with a dot';
    case 'trailing_dot_or_space':
      return 'The folder name cannot end with a dot or a space';
    case 'control_character':
      return 'Control characters are not allowed';
    case 'reserved_character':
      return 'Reserved characters are not allowed: : * ? " < > |';
    default: {
      const exhaustive: never = validation.kind;
      return exhaustive;
    }
  }
};
