type OfParams = {
  readonly mountId: string | null;
};

export type WhereOf = (params: OfParams) => string | null;
