import type { ImplementationCluster } from '@goodboy/types';
import type { ArtifactRevision } from '@goodboy/db';
import type { PlanVersion } from './settlePlanComments';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const textList = ({ value }: { readonly value: unknown }): ReadonlyArray<string> =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const clusterOf = ({ value }: { readonly value: unknown }): ImplementationCluster | null => {
  if (!isRecord(value) || typeof value['title'] !== 'string') {
    return null;
  }
  return {
    title: value['title'],
    instructions: typeof value['instructions'] === 'string' ? value['instructions'] : '',
    doneWhen: textList({ value: value['doneWhen'] }),
    touches: textList({ value: value['touches'] }),
  };
};

export const planVersionOfRevision = ({
  revision,
}: {
  readonly revision: Pick<ArtifactRevision, 'sourceText' | 'metadata'>;
}): PlanVersion => {
  const raw = revision.metadata['clusters'];
  const clusters = Array.isArray(raw)
    ? raw.flatMap((entry: unknown) => {
        const cluster = clusterOf({ value: entry });
        return cluster === null ? [] : [cluster];
      })
    : [];
  return { bodyMd: revision.sourceText, clusters };
};
