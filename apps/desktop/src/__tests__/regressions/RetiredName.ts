export type RetiredName = {
  readonly id: string;
  readonly pattern: RegExp;
  readonly use: string;
  readonly allowedPaths?: RegExp;
};
