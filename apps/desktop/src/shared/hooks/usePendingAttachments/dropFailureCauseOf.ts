import { CommandError } from '../../lib/invokeCommand';

export type DropFailureCause = 'gone' | 'denied' | 'unsupported' | 'too-large' | 'unknown';

type Params = {
  readonly error: unknown;
};

export const dropFailureCauseOf = ({ error }: Params): DropFailureCause => {
  if (!(error instanceof CommandError)) {
    return 'unknown';
  }
  switch (error.kind) {
    case 'gone':
      return 'gone';
    case 'denied':
      return 'denied';
    case 'unsupported_mime':
    case 'invalid_path':
      return 'unsupported';
    case 'too_large':
      return 'too-large';
    default:
      return 'unknown';
  }
};
