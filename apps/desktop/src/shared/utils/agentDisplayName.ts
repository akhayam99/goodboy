const LEGACY_RESOLVE_PREFIX = 'resolve: ';

export const isAutoResolverName = ({ name }: { readonly name: string }): boolean =>
  name.toLowerCase().startsWith(LEGACY_RESOLVE_PREFIX);

type Params = {
  readonly name: string;
  readonly kind: string;
};

export const agentDisplayName = ({ name, kind }: Params): string =>
  kind === 'resolver' && name.startsWith(LEGACY_RESOLVE_PREFIX)
    ? name.slice(LEGACY_RESOLVE_PREFIX.length)
    : name;
