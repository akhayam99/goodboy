import type { StorageScope } from '../../../store/slices/storage/types';

export type BranchScope = Exclude<StorageScope, { readonly kind: 'removed' }>;

type Params = {
  readonly scope: StorageScope;
};

export const branchScopeOf = ({ scope }: Params): BranchScope =>
  scope.kind === 'removed' ? { kind: 'all' } : scope;
