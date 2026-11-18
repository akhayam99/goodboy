import { shellQuote } from '../../shared/utils/shellQuote';
import { pushFixCommand } from './pushFixCommand';

type Params = {
  readonly branch: string;
  readonly remoteSha: string;
};

export const keepOriginCommand = ({ branch, remoteSha }: Params): string =>
  `git rebase ${shellQuote({ value: remoteSha })} && ${pushFixCommand({ branch, remoteSha: null })}`;
