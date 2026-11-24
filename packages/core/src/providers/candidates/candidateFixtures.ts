import type { ProviderId, ProviderPolicyEntry } from '@goodboy/types';
import type { CandidateInputs } from './types';

type Params = Partial<CandidateInputs> & {
  readonly on?: ReadonlyArray<ProviderId>;
  readonly backup?: ReadonlyArray<ProviderId>;
};

export const candidateInputsOf = ({
  on = ['anthropic', 'cursor', 'codex'],
  backup = [],
  ...rest
}: Params): CandidateInputs => ({
  defaultProvider: on[0] ?? 'anthropic',
  rule: 'order',
  policy: [
    ...on.map((id): ProviderPolicyEntry => ({ id, state: 'on' })),
    ...backup.map((id): ProviderPolicyEntry => ({ id, state: 'backup' })),
  ],
  ...rest,
});
