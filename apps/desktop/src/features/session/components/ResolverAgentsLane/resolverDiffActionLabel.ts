export type ResolverDiffTarget =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'commit'; readonly sha: string }
  | { readonly kind: 'working' };

type Params = {
  readonly target: ResolverDiffTarget;
};

export const resolverDiffActionLabel = ({ target }: Params): string => {
  switch (target.kind) {
    case 'unknown':
      return 'Open the diff';
    case 'commit':
      return `Open the diff of commit ${target.sha.slice(0, 7)}`;
    case 'working':
      return 'Open the diff of the uncommitted changes';
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
};
