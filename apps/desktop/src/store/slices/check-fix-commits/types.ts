export type { GetFn, SetFn } from '../../slice-types';

export type CheckFixCommit =
  | {
      readonly kind: 'found';
      readonly sha: string;
      readonly subject: string;
      readonly count: number;
      readonly unpushed: number;
    }
  | { readonly kind: 'none' }
  | { readonly kind: 'unreadable' };
