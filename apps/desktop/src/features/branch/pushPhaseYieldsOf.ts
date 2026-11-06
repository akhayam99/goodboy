type Params = {
  readonly kind: string;
};

const YIELDING: ReadonlySet<string> = new Set(['confirm', 'pushing', 'sync_confirm']);

export const pushPhaseYieldsOf = ({ kind }: Params): boolean => YIELDING.has(kind);
