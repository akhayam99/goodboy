import type { GhTokenStatus } from '@goodboy/types';

type Params = {
  readonly status: GhTokenStatus | null;
  readonly isScoped: boolean;
  readonly workspaceName: string;
};

type KeyKindParams = Pick<Params, 'status'>;

const keyKindOf = ({ status }: KeyKindParams): string | null => {
  if (status === null || status.mode === 'absent') {
    return null;
  }
  if (status.mode === 'gh-cli') {
    return 'gh CLI login';
  }
  return (status.scopes ?? []).includes('repo') ? 'API key, repo scope' : 'API key';
};

export const githubFactsOf = ({
  status,
  isScoped,
  workspaceName,
}: Params): ReadonlyArray<string> => {
  const keyKind = keyKindOf({ status });
  const scope = isScoped ? workspaceName : 'All workspaces';
  return keyKind === null ? [scope] : [scope, keyKind];
};
