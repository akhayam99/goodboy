import { captureArtifactFromTurnText } from '../artifacts/legacyAdapter';

export type RevisionFailure = 'no_new_version' | 'lost_structure';

export type RevisionParseOutcome =
  | Readonly<{
      kind: 'ok';
      title: string;
      sourceText: string;
      metadata: Readonly<Record<string, unknown>>;
    }>
  | Readonly<{ kind: 'failed'; reason: RevisionFailure }>;

export type ParseRevisionParams = Readonly<{
  assistantText: string;
  expectedKind: string;
  baseClusterCount: number;
}>;

type ClustersParams = {
  readonly metadata: Readonly<Record<string, unknown>>;
};

const clusterCountOf = ({ metadata }: ClustersParams): number => {
  const clusters = metadata['clusters'];
  return Array.isArray(clusters) ? clusters.length : 0;
};

export const parseRevisionFromTurn = ({
  assistantText,
  expectedKind,
  baseClusterCount,
}: ParseRevisionParams): RevisionParseOutcome => {
  const captured = captureArtifactFromTurnText({ assistantText, emittingProvider: null });
  if (captured.status !== 'captured') {
    return { kind: 'failed', reason: 'no_new_version' };
  }
  const artifact = captured.artifact;
  if (artifact.kind !== expectedKind || artifact.title.trim() === '') {
    return { kind: 'failed', reason: 'no_new_version' };
  }
  const metadata: Readonly<Record<string, unknown>> = { ...artifact.metadata };
  if (expectedKind === 'plan' && baseClusterCount >= 2 && clusterCountOf({ metadata }) === 0) {
    return { kind: 'failed', reason: 'lost_structure' };
  }
  return {
    kind: 'ok',
    title: artifact.title.trim(),
    sourceText: artifact.sourceText,
    metadata,
  };
};
