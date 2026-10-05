import type { ArtifactComment, ArtifactCommentAnchor, ImplementationCluster } from '@goodboy/types';
import { anchorHead, quoteOf, sortByAnchor } from './planCommentAnchors';

const OPENING = 'Please revise the plan:';

const CLOSING =
  'Write the full updated plan as one plan block, never a patch. Keep every part and every sentence these comments did not touch.';

const QUOTE_LIMIT = 400;

type Params = {
  readonly clusters: ReadonlyArray<ImplementationCluster>;
  readonly comments: ReadonlyArray<ArtifactComment>;
};

const clip = ({ text }: { readonly text: string }): string =>
  text.length <= QUOTE_LIMIT ? text : `${text.slice(0, QUOTE_LIMIT).trimEnd()}...`;

const partQuote = ({
  cluster,
}: {
  readonly cluster: ImplementationCluster | undefined;
}): string | null => {
  if (cluster === undefined) {
    return null;
  }
  const checks = (cluster.doneWhen ?? [])
    .map((check) => check.trim())
    .filter((check) => check.length > 0);
  if (checks.length > 0) {
    return `Done when: ${checks.join(' · ')}`;
  }
  const first = cluster.instructions
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return first === undefined ? null : first;
};

const quoteFor = ({
  anchor,
  clusters,
}: {
  readonly anchor: ArtifactCommentAnchor;
  readonly clusters: ReadonlyArray<ImplementationCluster>;
}): string | null =>
  anchor.kind === 'part' ? partQuote({ cluster: clusters[anchor.index] }) : quoteOf({ anchor });

const quoted = ({ text }: { readonly text: string }): string =>
  clip({ text })
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');

export const buildPlanCommentRequest = ({ clusters, comments }: Params): string => {
  const items = sortByAnchor({ comments }).map((comment) => {
    const quote = quoteFor({ anchor: comment.anchor, clusters });
    return [
      anchorHead({ anchor: comment.anchor }),
      ...(quote === null ? [] : [quoted({ text: quote })]),
      comment.body.trim(),
    ].join('\n');
  });
  return [OPENING, ...items, CLOSING].join('\n\n');
};
