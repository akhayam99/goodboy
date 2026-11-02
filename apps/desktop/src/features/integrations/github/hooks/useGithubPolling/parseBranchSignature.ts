import { brandId, type SessionId } from '@goodboy/types';

type Params = {
  readonly signature: string;
};

export const parseBranchSignature = ({ signature }: Params): ReadonlyMap<SessionId, string> => {
  const branches = new Map<SessionId, string>();
  for (const entry of signature.split(';')) {
    const at = entry.lastIndexOf('@');
    if (at > 0) {
      branches.set(brandId<SessionId>({ value: entry.slice(0, at) }), entry.slice(at + 1));
    }
  }
  return branches;
};
