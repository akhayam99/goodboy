type Params = {
  readonly commitShas: ReadonlyArray<string> | null | undefined;
  readonly integratedSha?: string | null;
};

export const threadFixSha = ({ commitShas, integratedSha = null }: Params): string | null =>
  commitShas?.at(-1) ?? integratedSha;
