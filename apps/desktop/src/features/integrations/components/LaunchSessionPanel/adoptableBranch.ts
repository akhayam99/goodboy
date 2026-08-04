export type AdoptableBranch = {
  readonly label: string;
  readonly branch: string | null;
  readonly hint: string;
  readonly isResolving: boolean;
  readonly error: string | null;
};
