import type { ResolverLink } from '../../../../session/resolver-linkage';

type Params = {
  readonly link: ResolverLink | undefined;
};

export const isClaimedLink = ({ link }: Params): boolean =>
  link != null && link.status !== 'failed';
