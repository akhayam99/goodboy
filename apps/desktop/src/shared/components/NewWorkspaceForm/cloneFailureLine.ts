import type { CloneHostKey } from '../../lib/repoClone/repoCloneTypes';
import { CLONE_FORMS } from './cloneForms';
import { CLONE_HOSTS } from './cloneHosts';
import type { CloneFailure } from './cloneFailureTypes';

const LOGIN_STEPS = {
  github: 'Run gh auth login, or connect GitHub in the Tools step.',
  gitlab: 'Run glab auth login, or connect GitLab in the Tools step.',
  bitbucket:
    'Sign in with git so it can read your Bitbucket login, or connect Bitbucket in the Tools step.',
} as const satisfies Record<CloneHostKey, string>;

type Params = {
  readonly failure: CloneFailure;
};

type HostParams = {
  readonly host: CloneHostKey | null;
};

const cloneHostLabelOf = ({ host }: HostParams): string =>
  CLONE_HOSTS.find((option) => option.key === host)?.label ?? 'the host';

export const cloneFailureLine = ({ failure }: Params): string => {
  const label = cloneHostLabelOf({ host: failure.host });
  switch (failure.kind) {
    case 'unknown_source':
      return `That isn't a repository address. ${CLONE_FORMS}`;
    case 'destination_not_empty':
      return `${failure.destination} already exists and Goodboy never overwrites a folder. Pick another name.`;
    case 'destination_not_a_folder':
      return `${failure.destination} can't hold a clone. Use a folder path that starts with ~/ or /.`;
    case 'network':
      return `Goodboy couldn't reach ${label}. Check your connection, then retry.`;
    case 'auth_refused':
    case 'not_found':
      return failure.host === null
        ? failure.message
        : `No ${label} login found for this repository. ${LOGIN_STEPS[failure.host]} A public repository needs no login.`;
    case 'failed':
      return failure.message;
    default: {
      const unreachable: never = failure.kind;
      return unreachable;
    }
  }
};
