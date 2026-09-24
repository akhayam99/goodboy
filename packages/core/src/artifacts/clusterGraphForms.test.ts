import { describe, expect, it } from 'vitest';
import { normalizeClusterGraph } from '../clusters';
import { captureArtifactFromTurnText } from './legacyAdapter';

const CLUSTERS = [
  { id: 'discovery', title: 'survey the routing', instructions: 'map it', role: 'scout' },
  {
    id: 'impl-a',
    title: 'rewrite the resolver',
    instructions: 'do it',
    dependsOn: ['discovery'],
  },
  {
    id: 'review',
    title: 'review the change',
    instructions: 'audit it',
    role: 'reviewer',
    dependsOn: ['impl-a'],
    expectedOutput: 'a findings list with file and line',
  },
];

const markerForm = `<<plan>>Routing rewrite

body
<</plan>>
<<clusters>>${JSON.stringify(CLUSTERS)}<</clusters>>`;

const envelopeForm = `<<artifact v=1 kind=plan>>
${JSON.stringify({
  title: 'Routing rewrite',
  format: 'markdown',
  content: 'body',
  metadata: { clusters: CLUSTERS },
})}
<</artifact>>`;

const clustersOf = (text: string) => {
  const captured = captureArtifactFromTurnText({ assistantText: text, emittingProvider: null });
  expect(captured.status).toBe('captured');
  if (captured.status !== 'captured' || captured.artifact.kind !== 'plan') {
    return [];
  }
  return captured.artifact.metadata.clusters ?? [];
};

describe('both plan forms', () => {
  it('normalize to the same cluster graph', () => {
    const fromMarker = normalizeClusterGraph({ clusters: clustersOf(markerForm) });
    const fromEnvelope = normalizeClusterGraph({ clusters: clustersOf(envelopeForm) });

    expect(fromMarker.kind).toBe('valid');
    expect(fromEnvelope).toEqual(fromMarker);
    expect(fromMarker.kind === 'valid' && fromMarker.graph.nodes.map((node) => node.role)).toEqual([
      'scout',
      'implementer',
      'reviewer',
    ]);
  });

  it('reject an invalid graph in either form with a stated reason', () => {
    const broken = [
      { id: 'a', title: 'one', instructions: 'x' },
      { id: 'b', title: 'two', instructions: 'y', dependsOn: ['ghost'] },
    ];
    const marker = captureArtifactFromTurnText({
      assistantText: `<<plan>>T\n\nbody\n<</plan>>\n<<clusters>>${JSON.stringify(broken)}<</clusters>>`,
      emittingProvider: null,
    });
    const envelope = captureArtifactFromTurnText({
      assistantText: `<<artifact v=1 kind=plan>>\n${JSON.stringify({
        title: 'T',
        format: 'markdown',
        content: 'body',
        metadata: { clusters: broken },
      })}\n<</artifact>>`,
      emittingProvider: null,
    });

    expect(marker.status).toBe('error');
    expect(envelope.status).toBe('error');
    expect(marker.status === 'error' && marker.message).toContain('"ghost"');
    expect(envelope.status === 'error' && envelope.message).toContain('"ghost"');
  });

  it('reject a role a plan cannot lay out in either form', () => {
    const planner = [{ id: 'a', title: 'one', instructions: 'x', role: 'planner' }];
    const marker = captureArtifactFromTurnText({
      assistantText: `<<plan>>T\n\nbody\n<</plan>>\n<<clusters>>${JSON.stringify(planner)}<</clusters>>`,
      emittingProvider: null,
    });
    const envelope = captureArtifactFromTurnText({
      assistantText: `<<artifact v=1 kind=plan>>\n${JSON.stringify({
        title: 'T',
        format: 'markdown',
        content: 'body',
        metadata: { clusters: planner },
      })}\n<</artifact>>`,
      emittingProvider: null,
    });

    expect(marker.status === 'error' && marker.message).toContain('planner');
    expect(envelope.status === 'error' && envelope.message).toContain('planner');
  });
});
