import { describe, expect, it } from 'vitest';
import { ARTIFACT_MAX_BYTES } from './grammar';
import { parseArtifactEnvelope } from './parseArtifactEnvelope';

const envelope = (attrs: string, body: string): string =>
  `intro line\n<<artifact ${attrs}>>\n${body}\n<</artifact>>\ntrailing line`;

describe('parseArtifactEnvelope', () => {
  it('returns none when no marker is present', () => {
    expect(parseArtifactEnvelope('just prose').status).toBe('none');
  });

  it('captures a report envelope', () => {
    const result = parseArtifactEnvelope(
      envelope(
        'v=1 kind=report',
        JSON.stringify({
          title: 'Session report',
          format: 'markdown',
          content: '## Outcome\nshipped',
          metadata: { reportType: 'pr-report' },
        }),
      ),
    );
    expect(result.status).toBe('captured');
    if (result.status !== 'captured') return;
    expect(result.artifact.kind).toBe('report');
    expect(result.artifact.title).toBe('Session report');
    expect(result.artifact.sourceFormat).toBe('markdown');
    expect(result.artifact.sourceText).toBe('## Outcome\nshipped');
    expect(result.artifact.metadata).toEqual({ reportType: 'pr-report' });
    expect(result.artifact.origin).toBe('envelope');
  });

  it('captures a plan envelope with clusters', () => {
    const result = parseArtifactEnvelope(
      envelope(
        'v=1 kind=plan',
        JSON.stringify({
          title: 'Ship it',
          format: 'markdown',
          content: 'step one',
          metadata: { clusters: [{ title: 'move files', instructions: 'do it' }] },
        }),
      ),
    );
    expect(result.status).toBe('captured');
    if (result.status !== 'captured' || result.artifact.kind !== 'plan') return;
    expect(result.artifact.metadata.clusters).toHaveLength(1);
  });

  it('captures a wireframe envelope and defaults its metadata', () => {
    const result = parseArtifactEnvelope(
      envelope(
        'v=1 kind=wireframe',
        JSON.stringify({
          title: 'Onboarding',
          format: 'json',
          content: { screens: [] },
        }),
      ),
    );
    expect(result.status).toBe('captured');
    if (result.status !== 'captured' || result.artifact.kind !== 'wireframe') return;
    expect(result.artifact.sourceFormat).toBe('json');
    expect(result.artifact.sourceText).toBe('{"screens":[]}');
    expect(result.artifact.metadata).toEqual({ fidelity: 'low', designProfile: {} });
  });

  it('accepts quoted attribute values', () => {
    const result = parseArtifactEnvelope(
      envelope('v="1" kind="report"', JSON.stringify({ title: 'T', content: 'body' })),
    );
    expect(result.status).toBe('captured');
  });

  it('ignores an envelope inside a code fence', () => {
    const text = [
      'here is the format:',
      '```text',
      '<<artifact v=1 kind=report>>',
      '{"title":"Example","content":"body"}',
      '<</artifact>>',
      '```',
    ].join('\n');
    expect(parseArtifactEnvelope(text).status).toBe('none');
  });

  it('keeps a fenced block inside the envelope body', () => {
    const body = JSON.stringify({ title: 'T', content: 'code:\n```ts\nconst a = 1;\n```' });
    const result = parseArtifactEnvelope(envelope('v=1 kind=report', body));
    expect(result.status).toBe('captured');
    if (result.status !== 'captured') return;
    expect(result.artifact.sourceText).toContain('const a = 1;');
  });

  it('reports a truncated block', () => {
    const result = parseArtifactEnvelope('<<artifact v=1 kind=report>>\n{"title":"T"}');
    expect(result).toMatchObject({ status: 'error', code: 'truncated' });
  });

  it('rejects two blocks in one turn', () => {
    const one = envelope('v=1 kind=report', JSON.stringify({ title: 'A', content: 'a' }));
    const two = envelope('v=1 kind=report', JSON.stringify({ title: 'B', content: 'b' }));
    const result = parseArtifactEnvelope(`${one}\n${two}`);
    expect(result).toMatchObject({ status: 'error', code: 'multiple_blocks' });
  });

  it('rejects malformed JSON', () => {
    const result = parseArtifactEnvelope(envelope('v=1 kind=report', '{not json'));
    expect(result).toMatchObject({ status: 'error', code: 'invalid_json' });
  });

  it('rejects an unknown kind', () => {
    const result = parseArtifactEnvelope(
      envelope('v=1 kind=diagram', JSON.stringify({ title: 'T', content: 'c' })),
    );
    expect(result).toMatchObject({ status: 'error', code: 'unknown_kind' });
  });

  it('rejects an unsupported contract version', () => {
    const result = parseArtifactEnvelope(
      envelope('v=2 kind=report', JSON.stringify({ title: 'T', content: 'c' })),
    );
    expect(result).toMatchObject({ status: 'error', code: 'unsupported_version' });
  });

  it('rejects a version attribute that only starts with a supported number', () => {
    const result = parseArtifactEnvelope(
      envelope('v=1garbage kind=report', JSON.stringify({ title: 'T', content: 'c' })),
    );
    expect(result).toMatchObject({ status: 'error', code: 'unsupported_version' });
  });

  it('rejects a version attribute with a sign, a decimal point or a trailing suffix', () => {
    const body = JSON.stringify({ title: 'T', content: 'c' });
    const results = ['v=+1', 'v=1.0', 'v=1e0', 'v=01x'].map((attr) =>
      parseArtifactEnvelope(envelope(`${attr} kind=report`, body)),
    );
    expect(results.every((result) => result.status === 'error')).toBe(true);
  });

  it('rejects a format that does not match the kind', () => {
    const result = parseArtifactEnvelope(
      envelope('v=1 kind=report', JSON.stringify({ title: 'T', format: 'json', content: 'c' })),
    );
    expect(result).toMatchObject({ status: 'error', code: 'invalid_format' });
  });

  it('rejects a missing title', () => {
    const result = parseArtifactEnvelope(
      envelope('v=1 kind=report', JSON.stringify({ content: 'c' })),
    );
    expect(result).toMatchObject({ status: 'error', code: 'invalid_payload' });
  });

  it('rejects a payload over the size cap', () => {
    const body = JSON.stringify({ title: 'T', content: 'x'.repeat(ARTIFACT_MAX_BYTES + 10) });
    const result = parseArtifactEnvelope(envelope('v=1 kind=report', body));
    expect(result).toMatchObject({ status: 'error', code: 'too_large' });
  });

  it('ignores a marker that shares its line with prose', () => {
    const text = 'see <<artifact v=1 kind=report>> for the shape';
    expect(parseArtifactEnvelope(text).status).toBe('none');
  });

  it('is stable when the same text is replayed', () => {
    const text = envelope('v=1 kind=report', JSON.stringify({ title: 'T', content: 'c' }));
    expect(parseArtifactEnvelope(text)).toEqual(parseArtifactEnvelope(text));
  });
});
