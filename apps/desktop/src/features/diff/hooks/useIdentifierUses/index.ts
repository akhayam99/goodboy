import { useCallback, useEffect, useState } from 'react';
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
  | { readonly status: 'error'; readonly message: string; readonly retry: () => void };

type Settled = Exclude<IdentifierUses, { readonly status: 'error' }>;

type Failed = { readonly status: 'error'; readonly message: string };

const SEARCHING: Settled = { status: 'searching' };

export const useIdentifierUses = ({ worktreePath, word }: Params): IdentifierUses => {
  const [uses, setUses] = useState<Settled | Failed>(SEARCHING);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);
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
  }, [worktreePath, word, attempt]);
  return uses.status === 'error' ? { ...uses, retry } : uses;
};
