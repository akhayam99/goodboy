const LEGACY_RESOLVE_PREFIX = 'resolve: ';

type Params = {
  readonly name: string;
};

export const agentDisplayName = ({ name }: Params): string =>
  name.startsWith(LEGACY_RESOLVE_PREFIX) ? name.slice(LEGACY_RESOLVE_PREFIX.length) : name;
