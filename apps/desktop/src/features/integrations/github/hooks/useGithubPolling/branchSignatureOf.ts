import type { Session } from '@goodboy/types';
import type { AppState } from '../../../../../store/types';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly branches: AppState['sessionBranches'];
};

type Memo = Params & {
  readonly signature: string;
};

let memo: Memo | null = null;

export const branchSignatureOf = ({ sessions, branches }: Params): string => {
  if (memo !== null && memo.sessions === sessions && memo.branches === branches) {
    return memo.signature;
  }
  let signature = '';
  for (const session of sessions) {
    signature += `${session.id}@${branches[session.id] ?? ''};`;
  }
  memo = { sessions, branches, signature };
  return signature;
};
