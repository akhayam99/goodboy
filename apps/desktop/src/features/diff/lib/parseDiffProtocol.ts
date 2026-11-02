import type { FileDiff } from '@goodboy/types';

export type ParseDiffRequest = {
  readonly id: number;
  readonly raw: string;
};

export type ParseDiffResponse =
  | { readonly id: number; readonly files: ReadonlyArray<FileDiff> }
  | { readonly id: number; readonly files: null };
