import { useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { worktreeGrepWord, type GrepMatch } from '../../../worktree/worktree';

type Params = {
  readonly worktreePath: string;
  readonly word: string;
};

export type IdentifierUses =
  | { readonly status: 'searching' }
  | {
      readonly status: 'ready';
      readonly matches: ReadonlyArray<GrepMatch>;
      readonly isTruncated: boolean;
    }
  | { readonly status: 'error'; readonly message: string };

const SEARCHING: IdentifierUses = { status: 'searching' };

export const useIdentifierUses = ({ worktreePath, word }: Params): IdentifierUses => {
  const [uses, setUses] = useState<IdentifierUses>(SEARCHING);
  useEffect(() => {
    let isLatest = true;
    setUses(SEARCHING);
    worktreeGrepWord({ worktreePath, word }).then(
      (result) => {
        if (isLatest) {
          setUses({ status: 'ready', matches: result.matches, isTruncated: result.isTruncated });
        }
      },
      (error: unknown) => {
        if (isLatest) {
          setUses({ status: 'error', message: formatError(error) });
        }
      },
    );
    return () => {
      isLatest = false;
    };
  }, [worktreePath, word]);
  return uses;
};
