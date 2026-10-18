import type { StorageScope } from '../../../store/slices/storage/types';

export type BranchScope = Exclude<StorageScope, { readonly kind: 'removed' }>;
