type Params = {
  readonly kind: string;
  readonly objectId: string;
  readonly version: string;
};

export const actionIdOf = ({ kind, objectId, version }: Params): string =>
  `act:${kind}:${objectId}:${version}`;
