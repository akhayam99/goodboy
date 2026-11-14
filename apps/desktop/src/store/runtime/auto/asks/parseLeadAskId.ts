import type { AutoGrantId } from '@goodboy/db';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import type { LeadAskRef } from './leadAskIdOf';

type Params = {
  readonly askId: string;
};

export const parseLeadAskId = ({ askId }: Params): LeadAskRef | null => {
  const split = askId.indexOf(':');
  if (split <= 0) {
    return null;
  }
  const kind = askId.slice(0, split);
  const rest = askId.slice(split + 1);
  if (rest === '') {
    return null;
  }
  if (kind === 'start') {
    return { kind, delegationId: brandId<AutoDelegationId>({ value: rest }) };
  }
  if (kind === 'grant') {
    return { kind, grantId: brandId<AutoGrantId>({ value: rest }) };
  }
  if (kind !== 'push') {
    return null;
  }
  const shaAt = rest.lastIndexOf(':');
  if (shaAt <= 0) {
    return null;
  }
  return {
    kind,
    delegationId: brandId<AutoDelegationId>({ value: rest.slice(0, shaAt) }),
    sha: rest.slice(shaAt + 1),
  };
};
