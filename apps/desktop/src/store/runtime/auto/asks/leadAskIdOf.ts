import type { AutoGrantId } from '@goodboy/db';
import type { AutoDelegationId } from '@goodboy/types';

export type LeadAskRef =
  | Readonly<{ kind: 'start'; delegationId: AutoDelegationId }>
  | Readonly<{ kind: 'push'; delegationId: AutoDelegationId; sha: string }>
  | Readonly<{ kind: 'grant'; grantId: AutoGrantId }>;

type Params = {
  readonly ref: LeadAskRef;
};

export const leadAskIdOf = ({ ref }: Params): string => {
  switch (ref.kind) {
    case 'start':
      return `start:${ref.delegationId}`;
    case 'push':
      return `push:${ref.delegationId}:${ref.sha}`;
    case 'grant':
      return `grant:${ref.grantId}`;
    default: {
      const unreachable: never = ref;
      return unreachable;
    }
  }
};
