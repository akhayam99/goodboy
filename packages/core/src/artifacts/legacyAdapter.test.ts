import { describe, expect, it } from 'vitest';
import { extractPlanFromMarker } from '../context';
import { captureArtifactFromTurnText, parseLegacyPlanMarkers } from './legacyAdapter';

const FIXTURES: ReadonlyArray<string> = [
  '<<plan>>\n# Refactor the store\n\nsplit the monolith\n<</plan>>',
  'preamble\n<<plan>>\nShip the release\nstep one\nstep two\n<</plan>>\nepilogue',
  '<<plan>>\n\n\n## Nested heading\nbody text\n<</plan>>',
  '<<plan>>\nOnly a title\n<</plan>>',
  '<<plan>>\nFirst plan\nbody a\n<</plan>>\n<<plan>>\nSecond plan\nbody b\n<</plan>>',
];

describe('parseLegacyPlanMarkers', () => {
  it('returns none without a plan marker', () => {
    expect(
      parseLegacyPlanMarkers({ assistantText: 'no markers', emittingProvider: null }).status,
    ).toBe('none');
  });

  it('matches extractPlanFromMarker on every fixture', () => {
    for (const assistantText of FIXTURES) {
      const legacy = extractPlanFromMarker(assistantText);
      const result = parseLegacyPlanMarkers({ assistantText, emittingProvider: null });
      expect(result.status).toBe('captured');
      if (result.status !== 'captured') continue;
      expect(result.artifact.title).toBe(legacy?.title);
      expect(result.artifact.sourceText).toBe(legacy?.bodyMd);
      expect(result.artifact.kind).toBe('plan');
      expect(result.artifact.origin).toBe('legacy');
    }
  });

  it('carries the clusters marker into plan metadata', () => {
    const assistantText = [
      '<<plan>>',
      'Ship it',
      'body',
      '<</plan>>',
      '<<clusters>>',
      JSON.stringify([{ title: 'move files', instructions: 'move them' }]),
      '<</clusters>>',
    ].join('\n');
    const result = parseLegacyPlanMarkers({ assistantText, emittingProvider: null });
    expect(result.status).toBe('captured');
    if (result.status !== 'captured' || result.artifact.kind !== 'plan') return;
    expect(result.artifact.metadata.clusters).toEqual([
      { title: 'move files', instructions: 'move them' },
    ]);
  });

  it('carries doneWhen and touches from the clusters marker', () => {
    const assistantText = [
      '<<plan>>',
      'Ship it',
      'body',
      '<</plan>>',
      '<<clusters>>',
      JSON.stringify([
        {
          title: 'move files',
          instructions: 'move them',
          doneWhen: ['run pnpm test'],
          touches: ['src/ledger'],
        },
      ]),
      '<</clusters>>',
    ].join('\n');
    const result = parseLegacyPlanMarkers({ assistantText, emittingProvider: null });
    if (result.status !== 'captured' || result.artifact.kind !== 'plan') {
      throw new Error('expected a captured plan');
    }
    expect(result.artifact.metadata.clusters).toEqual([
      {
        title: 'move files',
        instructions: 'move them',
        doneWhen: ['run pnpm test'],
        touches: ['src/ledger'],
      },
    ]);
  });
});

describe('captureArtifactFromTurnText', () => {
  it('prefers the envelope when both are present', () => {
    const assistantText = [
      '<<plan>>',
      'Legacy title',
      'legacy body',
      '<</plan>>',
      '<<artifact v=1 kind=plan>>',
      JSON.stringify({ title: 'Envelope title', content: 'envelope body' }),
      '<</artifact>>',
    ].join('\n');
    const result = captureArtifactFromTurnText({ assistantText, emittingProvider: null });
    expect(result.status).toBe('captured');
    if (result.status !== 'captured') return;
    expect(result.artifact.title).toBe('Envelope title');
    expect(result.artifact.origin).toBe('envelope');
  });

  it('falls back to legacy markers when no envelope is present', () => {
    const result = captureArtifactFromTurnText({
      assistantText: '<<plan>>\nLegacy title\nlegacy body\n<</plan>>',
      emittingProvider: null,
    });
    expect(result.status).toBe('captured');
    if (result.status !== 'captured') return;
    expect(result.artifact.origin).toBe('legacy');
  });

  it('surfaces the envelope error instead of falling back', () => {
    const assistantText = [
      '<<plan>>',
      'Legacy title',
      'legacy body',
      '<</plan>>',
      '<<artifact v=1 kind=plan>>',
      '{broken',
      '<</artifact>>',
    ].join('\n');
    expect(captureArtifactFromTurnText({ assistantText, emittingProvider: null })).toMatchObject({
      status: 'error',
      code: 'invalid_json',
    });
  });
});
