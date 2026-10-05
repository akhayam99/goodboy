import type { ArtifactComment, ImplementationCluster } from '@goodboy/types';
import { normalizeText } from './planCommentAnchors';

export type PlanVersion = Readonly<{
  bodyMd: string;
  clusters: ReadonlyArray<ImplementationCluster>;
}>;

export type CommentSettlement = Readonly<{
  addressed: ReadonlyArray<string>;
  open: ReadonlyArray<string>;
}>;

const clusterKey = ({ cluster }: { readonly cluster: ImplementationCluster }): string =>
  JSON.stringify([
    normalizeText({ text: cluster.title }),
    normalizeText({ text: cluster.instructions }),
    (cluster.doneWhen ?? []).map((check) => normalizeText({ text: check })),
    cluster.touches ?? [],
  ]);

const plainOf = ({ text }: { readonly text: string }): string =>
  normalizeText({
    text: text
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`#>~]/g, '')
      .replace(/^\s*[-+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, ''),
  });

const isPartChanged = ({
  index,
  before,
  after,
}: {
  readonly index: number;
  readonly before: PlanVersion;
  readonly after: PlanVersion;
}): boolean => {
  const was = before.clusters[index];
  if (was === undefined) {
    return true;
  }
  const key = clusterKey({ cluster: was });
  return !after.clusters.some((cluster) => clusterKey({ cluster }) === key);
};

const isTextChanged = ({
  text,
  after,
}: {
  readonly text: string;
  readonly after: PlanVersion;
}): boolean => !plainOf({ text: after.bodyMd }).includes(plainOf({ text }));

export const settlePlanComments = ({
  comments,
  before,
  after,
}: {
  readonly comments: ReadonlyArray<ArtifactComment>;
  readonly before: PlanVersion;
  readonly after: PlanVersion;
}): CommentSettlement => {
  const addressed: Array<string> = [];
  const open: Array<string> = [];
  for (const comment of comments) {
    const { anchor } = comment;
    const isChanged =
      anchor.kind === 'part'
        ? isPartChanged({ index: anchor.index, before, after })
        : isTextChanged({ text: anchor.text, after });
    (isChanged ? addressed : open).push(comment.id);
  }
  return { addressed, open };
};
