const LEGACY_RESOLVE_PREFIX = 'resolve: ';

type Params = {
  readonly name: string;
  readonly kind: string;
};

export const agentDisplayName = ({ name, kind }: Params): string =>
  kind === 'resolver' && name.startsWith(LEGACY_RESOLVE_PREFIX)
    ? name.slice(LEGACY_RESOLVE_PREFIX.length)
    : name;
