import type { OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null;
};

export const detailWidthIdOf = ({ drawer }: Params): string | null => {
  if (drawer === null) {
    return null;
  }
  if (drawer.kind === 'artifact' || drawer.kind === 'artifact-document') {
    return `${drawer.kind}:${drawer.payload.artifactId}`;
  }
  return drawer.kind;
};
