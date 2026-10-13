import { shellQuote } from '../../shared/utils/shellQuote';

type Params = {
  readonly branch: string;
  readonly remoteSha: string | null;
};

export const pushFixCommand = ({ branch, remoteSha }: Params): string => {
  const quotedBranch = shellQuote({ value: branch });
  if (remoteSha === null) {
    return `git push origin ${quotedBranch}`;
  }
  const lease = shellQuote({ value: `${branch}:${remoteSha}` });
  return `git push --force-with-lease=${lease} origin ${quotedBranch}`;
};
